"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tasks_1 = require("../@types/tasks");
const container_1 = require("../di/container");
const types_1 = require("../di/types");
const cached_cist_json_client_service_1 = require("../services/cist/cached-cist-json-client.service");
const exit_handler_service_1 = require("../services/exit-handler.service");
const buildings_service_1 = require("../services/google/buildings.service");
const runner_1 = require("../tasks/runner");
const task_step_executor_1 = require("../tasks/task-step-executor");
const jobs_1 = require("../utils/jobs");
async function handleSync(args, config, logger) {
    const container = container_1.createContainer({
        types: [
            types_1.TYPES.TaskStepExecutor,
            types_1.TYPES.TaskProgressBackend,
            ...jobs_1.getCistCachedClientTypes(args, config.ncgc.caching.cist.priorities)
        ],
        forceNew: true,
    });
    container.bind(types_1.TYPES.CistJsonClient)
        .to(cached_cist_json_client_service_1.CachedCistJsonClientService);
    container.bind(types_1.TYPES.BuildingsService)
        .to(buildings_service_1.BuildingsService);
    await container_1.getContainerAsyncInitializer();
    const executor = container.get(types_1.TYPES.TaskStepExecutor);
    const taskRunner = new runner_1.TaskRunner(executor);
    executor.on(task_step_executor_1.EventNames.NewTask, (task) => {
        taskRunner.enqueueTask(task);
    });
    let interrupted = false;
    const dispose = async () => {
        interrupted = true;
        await taskRunner.runningPromise;
        taskRunner.enqueueAllTwiceFailedTasksAndClear();
        const unrunTasks = taskRunner.getAllUndoneTasks(false);
        const saver = container.get(types_1.TYPES.TaskProgressBackend);
        saver.save(unrunTasks);
    };
    exit_handler_service_1.bindOnExitHandler(dispose);
    const tasks = [];
    if (args.auditories) {
        tasks.push({
            taskType: tasks_1.TaskType.DeferredEnsureBuildings
        });
    }
    for await (const _ of taskRunner.asRunnableGenerator()) {
        if (interrupted) {
            return;
        }
    }
    exit_handler_service_1.unbindOnExitHandler(dispose);
}
exports.handleSync = handleSync;
//# sourceMappingURL=sync.js.map