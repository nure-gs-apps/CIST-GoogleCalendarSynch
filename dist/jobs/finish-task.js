"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tasks_1 = require("../@types/tasks");
const types_1 = require("../config/types");
const container_1 = require("../di/container");
const types_2 = require("../di/types");
const cached_cist_json_client_service_1 = require("../services/cist/cached-cist-json-client.service");
const deadline_service_1 = require("../services/deadline.service");
const exit_handler_service_1 = require("../services/exit-handler.service");
const file_1 = require("../tasks/progress/file");
const runner_1 = require("../tasks/runner");
const task_step_executor_1 = require("../tasks/task-step-executor");
async function handleFinishTask(config, logger) {
    const container = container_1.createContainer({
        types: [types_2.TYPES.TaskProgressBackend],
        forceNew: true,
    });
    exit_handler_service_1.bindOnExitHandler(container_1.disposeContainer);
    await container_1.getContainerAsyncInitializer();
    const progressBackend = container.get(types_2.TYPES.TaskProgressBackend);
    const tasks = await (progressBackend instanceof file_1.TaskProgressFileBackend
        ? progressBackend.load()
        : progressBackend.loadAndClear());
    container_1.addTypesToContainer(getRequiredServicesConfig(tasks));
    container.bind(types_2.TYPES.CistJsonClient)
        .to(cached_cist_json_client_service_1.CachedCistJsonClientService);
    await container_1.getContainerAsyncInitializer();
    const executor = container.get(types_2.TYPES.TaskStepExecutor);
    const taskRunner = new runner_1.TaskRunner(executor, config.ncgc.tasks.concurrency);
    executor.on(task_step_executor_1.TaskStepExecutorEventNames.NewTask, (task) => {
        taskRunner.enqueueTask(task);
    });
    let interrupted = false;
    const dispose = async () => {
        exit_handler_service_1.disableExitTimeout();
        logger.info('Waiting for current task step to finish...');
        await saveInterruptedTasks();
        exit_handler_service_1.enableExitTimeout();
    };
    exit_handler_service_1.bindOnExitHandler(dispose);
    const deadlineService = new deadline_service_1.DeadlineService(types_1.parseTasksTimeout(config.ncgc));
    deadlineService.on(deadline_service_1.DeadlineServiceEventNames.Deadline, () => {
        logger.info('Time has run out, saving interrupted tasks...');
        saveInterruptedTasks().catch(error => logger.error('Error while saving interrupted task', error));
    });
    taskRunner.enqueueTasks(false, ...tasks);
    logger.info('Running tasks...');
    for await (const _ of taskRunner.asRunnableGenerator()) {
        if (interrupted) {
            break;
        }
    }
    let deleteProgressFile = true;
    if (!interrupted && taskRunner.hasFailedTasks()) {
        logger.warn(`${taskRunner.getFailedStepCount()} failed task steps found. Rerunning...`);
        for await (const _ of taskRunner.asFailedRunnableGenerator()) {
            if (interrupted) {
                break;
            }
        }
        if (taskRunner.hasTwiceFailedTasks()) {
            logger.error(`Rerunning ${taskRunner.getTwiceFailedStepCount()} failed task steps failed. Saving these steps...`);
            await progressBackend.save(taskRunner.getTwiceFailedTasks(false));
            deleteProgressFile = false;
        }
    }
    if (progressBackend instanceof file_1.TaskProgressFileBackend
        && !interrupted
        && deleteProgressFile) {
        await progressBackend.clear();
    }
    logger.info(!interrupted
        ? 'Finished job'
        : 'Job execution was interrupted');
    exit_handler_service_1.unbindOnExitHandler(dispose);
    exit_handler_service_1.exitGracefully(0);
    async function saveInterruptedTasks() {
        interrupted = true;
        await taskRunner.runningPromise;
        taskRunner.enqueueAllTwiceFailedTasksAndClear();
        const undoneTasks = taskRunner.getAllUndoneTasks(false);
        await progressBackend.save(undoneTasks);
    }
}
exports.handleFinishTask = handleFinishTask;
function getRequiredServicesConfig(tasks) {
    const types = [
        cached_cist_json_client_service_1.CachedCistJsonClientService,
        types_2.TYPES.TaskStepExecutor
    ];
    if (tasks.some(({ taskType }) => (taskType === tasks_1.TaskType.DeferredEnsureBuildings
        || taskType === tasks_1.TaskType.DeferredDeleteIrrelevantBuildings
        || taskType === tasks_1.TaskType.EnsureBuildings
        || taskType === tasks_1.TaskType.DeleteIrrelevantBuildings))) {
        types.push(types_2.TYPES.BuildingsService);
    }
    if (tasks.some(({ taskType }) => (taskType === tasks_1.TaskType.DeferredEnsureBuildings
        || taskType === tasks_1.TaskType.DeferredDeleteIrrelevantBuildings))) {
        types.push(cached_cist_json_client_service_1.CachedCistJsonClientService);
    }
    return { types };
}
//# sourceMappingURL=finish-task.js.map