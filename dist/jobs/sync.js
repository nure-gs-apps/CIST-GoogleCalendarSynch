"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tasks_1 = require("../@types/tasks");
const container_1 = require("../di/container");
const types_1 = require("../di/types");
const cached_cist_json_client_service_1 = require("../services/cist/cached-cist-json-client.service");
const exit_handler_service_1 = require("../services/exit-handler.service");
const runner_1 = require("../tasks/runner");
const task_step_executor_1 = require("../tasks/task-step-executor");
const jobs_1 = require("../utils/jobs");
function addEntitiesToRemoveOptions(yargs) {
    const buildingsName = "deleteIrrelevantBuildings";
    const auditoriesName = "deleteIrrelevantAuditories";
    const groupsName = "deleteIrrelevantGroups";
    const eventsName = "deleteIrrelevantEvents";
    return yargs
        .option(buildingsName, {
        description: 'Delete irrelevant buildings, that are not found in current CIST Auditories response',
        type: 'boolean'
    })
        .option(auditoriesName, {
        description: 'Delete irrelevant auditories, that are not found in current CIST Auditories response',
        type: 'boolean'
    })
        .option(groupsName, {
        description: 'Delete irrelevant groups, that are not found in current CIST Groups response',
        type: 'boolean'
    })
        .option(eventsName, {
        description: 'Delete irrelevant events, that are not found in current CIST Events responses',
        type: 'boolean'
    });
}
exports.addEntitiesToRemoveOptions = addEntitiesToRemoveOptions;
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
        types_1.TYPES.TaskStepExecutor,
        types_1.TYPES.TaskProgressBackend,
        ...jobs_1.getCistCachedClientTypes(args, config.ncgc.caching.cist.priorities),
        cached_cist_json_client_service_1.CachedCistJsonClientService,
    ];
    if (args.auditories || args.deleteIrrelevantBuildings) {
        types.push(types_1.TYPES.BuildingsService);
    }
    const container = container_1.createContainer({
        types,
        forceNew: true,
    });
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
        exit_handler_service_1.disableExitTimeout();
        interrupted = true;
        logger.info('Waiting for current task step to finish...');
        await taskRunner.runningPromise;
        taskRunner.enqueueAllTwiceFailedTasksAndClear();
        const undoneTasks = taskRunner.getAllUndoneTasks(false);
        const progressBackend = container.get(types_1.TYPES.TaskProgressBackend);
        await progressBackend.save(undoneTasks);
    };
    exit_handler_service_1.bindOnExitHandler(dispose);
    taskRunner.enqueueTasks(false, ...tasks);
    for await (const _ of taskRunner.asRunnableGenerator()) {
        if (interrupted) {
            break;
        }
    }
    if (taskRunner.hasFailedTasks()) {
        logger.warn(`Totally ${taskRunner.getFailedStepCount()} task steps failed. Rerunning...`);
        for await (const _ of taskRunner.asFailedRunnableGenerator()) {
            if (interrupted) {
                break;
            }
        }
        if (taskRunner.hasTwiceFailedTasks()) {
            logger.error(`Rerunning ${taskRunner.getTwiceFailedStepCount()} failed task steps failed. Saving these steps...`);
            const progressBackend = container.get(types_1.TYPES.TaskProgressBackend);
            await progressBackend.save(taskRunner.getTwiceFailedTasks(false));
        }
    }
    logger.info('Finished synchronization');
    exit_handler_service_1.unbindOnExitHandler(dispose);
    exit_handler_service_1.exitGracefully(0);
}
exports.handleSync = handleSync;
//# sourceMappingURL=sync.js.map