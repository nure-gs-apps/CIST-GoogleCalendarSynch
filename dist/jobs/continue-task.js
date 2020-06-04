"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tasks_1 = require("../@types/tasks");
const container_1 = require("../di/container");
const types_1 = require("../di/types");
const cached_cist_json_client_service_1 = require("../services/cist/cached-cist-json-client.service");
const exit_handler_service_1 = require("../services/exit-handler.service");
const runner_1 = require("../tasks/runner");
const task_step_executor_1 = require("../tasks/task-step-executor");
async function handleContinueTask(config, logger) {
    const container = container_1.createContainer({
        types: [types_1.TYPES.TaskProgressBackend],
        forceNew: true,
    });
    exit_handler_service_1.bindOnExitHandler(container_1.disposeContainer);
    await container_1.getContainerAsyncInitializer();
    const progressBackend = container.get(types_1.TYPES.TaskProgressBackend);
    const tasks = await progressBackend.loadAndClear();
    container_1.addTypesToContainer(getRequiredServicesConfig(tasks));
    container.bind(types_1.TYPES.CistJsonClient)
        .to(cached_cist_json_client_service_1.CachedCistJsonClientService);
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
        const undoneTasks = taskRunner.getAllUndoneTasks(false);
        await progressBackend.save(undoneTasks);
    };
    exit_handler_service_1.bindOnExitHandler(dispose);
    taskRunner.enqueueTasks(false, ...tasks);
    for await (const _ of taskRunner.asRunnableGenerator()) {
        if (interrupted) {
            break;
        }
    }
    logger.info('Finished synchronization');
    exit_handler_service_1.unbindOnExitHandler(dispose);
    exit_handler_service_1.exitGracefully(0);
}
exports.handleContinueTask = handleContinueTask;
function getRequiredServicesConfig(tasks) {
    const types = [];
    if (tasks.some(({ taskType }) => (taskType === tasks_1.TaskType.DeferredEnsureBuildings
        || taskType === tasks_1.TaskType.DeferredDeleteIrrelevantBuildings
        || taskType === tasks_1.TaskType.EnsureBuildings
        || taskType === tasks_1.TaskType.DeleteIrrelevantBuildings))) {
        types.push(types_1.TYPES.BuildingsService);
    }
    if (tasks.some(({ taskType }) => (taskType === tasks_1.TaskType.DeferredEnsureBuildings
        || taskType === tasks_1.TaskType.DeferredDeleteIrrelevantBuildings))) {
        types.push(cached_cist_json_client_service_1.CachedCistJsonClientService);
    }
    return { types };
}
//# sourceMappingURL=continue-task.js.map