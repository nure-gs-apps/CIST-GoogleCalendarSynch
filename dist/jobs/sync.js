"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tasks_1 = require("../@types/tasks");
const types_1 = require("../config/types");
const container_1 = require("../di/container");
const types_2 = require("../di/types");
const cached_cist_json_client_service_1 = require("../services/cist/cached-cist-json-client.service");
const deadline_service_1 = require("../services/deadline.service");
const exit_handler_service_1 = require("../services/exit-handler.service");
const runner_1 = require("../tasks/runner");
const task_step_executor_1 = require("../tasks/task-step-executor");
const jobs_1 = require("../utils/jobs");
async function handleSync(args, config, logger) {
    const tasks = [];
    if (args.auditories) {
        tasks.push({
            taskType: tasks_1.TaskType.DeferredEnsureBuildings
        });
    }
    if (args.deleteIrrelevantAuditories) {
        tasks.push({
            taskType: tasks_1.TaskType.DeferredDeleteIrrelevantBuildings
        });
    }
    if (tasks.length === 0) {
        throw new TypeError('No tasks found. Please, specify either synchronization or removal.');
    }
    const types = [
        types_2.TYPES.TaskStepExecutor,
        types_2.TYPES.TaskProgressBackend,
        ...jobs_1.getCistCachedClientTypes(args, config.ncgc.caching.cist.priorities),
        cached_cist_json_client_service_1.CachedCistJsonClientService,
    ];
    if (args.auditories || args.deleteIrrelevantBuildings) {
        types.push(types_2.TYPES.BuildingsService);
    }
    const container = container_1.createContainer({
        types,
        forceNew: true,
    });
    container.bind(types_2.TYPES.CistJsonClient)
        .toDynamicValue(cached_cist_json_client_service_1.getSharedCachedCistJsonClientInstance);
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
    logger.info('Running synchronization tasks...');
    for await (const _ of taskRunner.asRunnableGenerator()) {
        if (interrupted) {
            break;
        }
    }
    if (!interrupted && taskRunner.hasFailedTasks()) {
        logger.warn(`Totally ${taskRunner.getFailedStepCount()} task steps failed. Rerunning...`);
        for await (const _ of taskRunner.asFailedRunnableGenerator()) {
            if (interrupted) {
                break;
            }
        }
        if (taskRunner.hasTwiceFailedTasks()) {
            logger.error(`Rerunning ${taskRunner.getTwiceFailedStepCount()} failed task steps failed. Saving these steps...`);
            const progressBackend = container.get(types_2.TYPES.TaskProgressBackend);
            await progressBackend.save(taskRunner.getTwiceFailedTasks(false));
        }
    }
    logger.info(!interrupted
        ? 'Finished synchronization'
        : 'Synchronization was interrupted');
    exit_handler_service_1.unbindOnExitHandler(dispose);
    exit_handler_service_1.exitGracefully(0);
    async function saveInterruptedTasks() {
        interrupted = true;
        await taskRunner.runningPromise;
        taskRunner.enqueueAllTwiceFailedTasksAndClear();
        if (taskRunner.hasAnyTasks()) {
            const undoneTasks = taskRunner.getAllUndoneTasks(false);
            const progressBackend = container.get(types_2.TYPES.TaskProgressBackend);
            await progressBackend.save(undoneTasks);
        }
        else {
            logger.info('All tasks were finished!');
        }
    }
}
exports.handleSync = handleSync;
//# sourceMappingURL=sync.js.map