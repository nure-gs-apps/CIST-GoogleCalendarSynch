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
const jobs_1 = require("../utils/jobs");
class RunTasksJob {
    constructor(config, logger, args) {
        Object.defineProperty(this, "_config", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "_logger", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "_args", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "_container", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "_progressBackend", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "_interrupted", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "_taskRunner", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this._config = config;
        this._logger = logger;
        this._args = args;
        this._container = null;
        this._progressBackend = null;
        this._interrupted = false;
        this._taskRunner = null;
    }
    async handle() {
        let tasks;
        if (this._args) {
            tasks = getTasksFromArgs(this._args);
            if (tasks.length === 0) {
                throw new TypeError('No tasks found. Please, specify either synchronization or removal.');
            }
            const types = this.getRequiredServicesFromTasks(tasks);
            types.push(types_2.TYPES.TaskProgressBackend);
            this._container = container_1.createContainer(this.getContainerConfig(types));
        }
        else {
            this._container = container_1.createContainer(this.getContainerConfig([types_2.TYPES.TaskProgressBackend]));
            exit_handler_service_1.bindOnExitHandler(container_1.disposeContainer);
            await container_1.getContainerAsyncInitializer();
            this._progressBackend = this._container.get(types_2.TYPES.TaskProgressBackend);
            tasks = await (this._progressBackend instanceof file_1.TaskProgressFileBackend
                ? this._progressBackend.load()
                : this._progressBackend.loadAndClear());
            container_1.addTypesToContainer({
                types: this.getRequiredServicesFromTasks(tasks)
            });
        }
        this._container.bind(types_2.TYPES.CistJsonClient)
            .toDynamicValue(cached_cist_json_client_service_1.getSharedCachedCistJsonClientInstance);
        let init = container_1.getContainerAsyncInitializer().finally(() => init = null);
        await init;
        const executor = this._container.get(types_2.TYPES.TaskStepExecutor);
        this._taskRunner = new runner_1.TaskRunner(executor, this._config.ncgc.tasks.concurrency);
        executor.on(task_step_executor_1.TaskStepExecutorEventNames.NewTask, (task) => {
            if (!this._taskRunner) {
                throw new TypeError('Unknown state');
            }
            this._taskRunner.enqueueTask(task);
            container_1.addTypesToContainer({
                types: this.getRequiredServicesFromTasks([task])
            });
            init = container_1.getContainerAsyncInitializer();
        });
        const dispose = async () => {
            exit_handler_service_1.disableExitTimeout();
            this._logger.info('Waiting for current task step to finish...');
            await this.saveInterruptedTasks();
            exit_handler_service_1.enableExitTimeout();
        };
        exit_handler_service_1.bindOnExitHandler(dispose);
        const deadlineService = new deadline_service_1.DeadlineService(types_1.parseTasksTimeout(this._config.ncgc));
        deadlineService.on(deadline_service_1.DeadlineServiceEventNames.Deadline, () => {
            this._logger.info('Time has run out, saving interrupted tasks...');
            this.saveInterruptedTasks().catch(error => this._logger.error('Error while saving interrupted task', error));
        });
        this._taskRunner.enqueueTasks(false, ...tasks);
        this._logger.info(this._args
            ? 'Running synchronization tasks...'
            : 'Running tasks...');
        for await (const _ of this._taskRunner.asRunnableGenerator()) {
            if (this._interrupted) {
                break;
            }
            if (init) {
                await init;
            }
        }
        let deleteProgressFile = true;
        if (!this._interrupted && this._taskRunner.hasFailedTasks()) {
            this._logger.warn(`Totally ${this._taskRunner.getFailedStepCount()} failed task steps found. Rerunning...`);
            for await (const _ of this._taskRunner.asFailedRunnableGenerator()) {
                if (this._interrupted) {
                    break;
                }
                if (init) {
                    await init;
                }
            }
            if (!this._interrupted && this._taskRunner.hasTwiceFailedTasks()) {
                this._logger.error(`Rerunning ${this._taskRunner.getTwiceFailedStepCount()} failed task steps failed. Saving these steps...`);
                if (!this._taskRunner) {
                    throw new TypeError('Unknown state');
                }
                await this.getProgressBackend()
                    .save(this._taskRunner.getTwiceFailedTasks(false));
                deleteProgressFile = false;
            }
        }
        if (!this._args
            && this._progressBackend instanceof file_1.TaskProgressFileBackend
            && !this._interrupted
            && deleteProgressFile) {
            await this._progressBackend.clear();
        }
        this._logger.info(!this._interrupted
            ? (this._args ? 'Finished synchronization' : 'Finished job')
            : (this._args
                ? 'Synchronization was interrupted'
                : 'Job execution was interrupted'));
        exit_handler_service_1.unbindOnExitHandler(dispose);
        exit_handler_service_1.exitGracefully(0);
    }
    async saveInterruptedTasks() {
        if (!this._taskRunner || !this._container) {
            throw new TypeError('Unknown state');
        }
        this._interrupted = true;
        await this._taskRunner.runningPromise;
        if (this._taskRunner.hasAnyTasks()) {
            this._logger.info('Saving interrupted tasks...');
            this._taskRunner.enqueueAllTwiceFailedTasksAndClear();
            const undoneTasks = this._taskRunner.getAllUndoneTasks(false);
            await this.getProgressBackend().save(undoneTasks);
        }
        else {
            this._logger.info('All tasks were finished!');
            if (!this._args) {
                await this.clearTaskProgressBackendIfCan();
            }
        }
    }
    async clearTaskProgressBackendIfCan() {
        if (this._progressBackend instanceof file_1.TaskProgressFileBackend) {
            await this._progressBackend.clear();
        }
    }
    getProgressBackend() {
        if (!this._progressBackend) {
            if (!this._container) {
                throw new TypeError('Unknown state');
            }
            this._progressBackend = this._container.get(types_2.TYPES.TaskProgressBackend);
        }
        return this._progressBackend;
    }
    getContainerConfig(types) {
        return {
            types,
            forceNew: true
        };
    }
    getRequiredServicesFromTasks(// TODO: move closer to task step executor
    tasks) {
        const types = [types_2.TYPES.TaskStepExecutor];
        if (tasks.some(({ taskType }) => (taskType === tasks_1.TaskType.DeferredDeleteIrrelevantBuildings
            // || taskType === TaskType.DeferredEnsureBuildings
            || taskType === tasks_1.TaskType.EnsureBuildings
            || taskType === tasks_1.TaskType.DeleteIrrelevantBuildings))) {
            types.push(types_2.TYPES.BuildingsService);
        }
        if (tasks.some(({ taskType }) => (taskType === tasks_1.TaskType.DeferredDeleteIrrelevantRooms
            // || taskType === TaskType.DeferredEnsureRooms
            || taskType === tasks_1.TaskType.EnsureRooms
            || taskType === tasks_1.TaskType.DeleteIrrelevantRooms))) {
            types.push(types_2.TYPES.RoomsService);
        }
        if (tasks.some(({ taskType }) => (taskType === tasks_1.TaskType.DeferredDeleteIrrelevantGroups
            // || taskType === TaskType.DeferredEnsureGroups
            || taskType === tasks_1.TaskType.EnsureGroups
            || taskType === tasks_1.TaskType.DeleteIrrelevantGroups))) {
            types.push(types_2.TYPES.GroupsService);
        }
        if (tasks.some(({ taskType }) => (taskType === tasks_1.TaskType.DeferredEnsureEvents
            || taskType === tasks_1.TaskType.DeferredDeleteIrrelevantEvents
            || taskType === tasks_1.TaskType.DeferredEnsureAndDeleteIrrelevantEvents
            || taskType === tasks_1.TaskType.InitializeEventsBaseContext
            || taskType === tasks_1.TaskType.InitializeEnsureEventsContext
            || taskType === tasks_1.TaskType.InitializeRelevantEventsContext
            || taskType === tasks_1.TaskType.InitializeEnsureAndRelevantEventsContext
            || taskType === tasks_1.TaskType.InsertEvents
            || taskType === tasks_1.TaskType.PatchEvents
            || taskType === tasks_1.TaskType.DeleteIrrelevantEvents))) {
            types.push(types_2.TYPES.EventsService);
        }
        if (tasks.some(({ taskType, steps }) => (taskType === tasks_1.TaskType.InitializeEventsBaseContext
            || taskType === tasks_1.TaskType.InitializeEnsureEventsContext
            || taskType === tasks_1.TaskType.InitializeRelevantEventsContext
            || taskType === tasks_1.TaskType.InitializeEnsureAndRelevantEventsContext
            || taskType === tasks_1.TaskType.InsertEvents
            || taskType === tasks_1.TaskType.PatchEvents
            || (taskType === tasks_1.TaskType.DeleteIrrelevantEvents
                && (!steps || steps.length === 0))
            || taskType === tasks_1.TaskType.ClearEventsContext))) {
            types.push(types_2.TYPES.GoogleCalendarEventsTaskContextStorage);
        }
        if (tasks.some(({ taskType }) => (taskType === tasks_1.TaskType.InitializeEnsureEventsContext
            || taskType === tasks_1.TaskType.InitializeRelevantEventsContext
            || taskType === tasks_1.TaskType.InitializeEnsureAndRelevantEventsContext))) {
            types.push(types_2.TYPES.GoogleEventContextService);
        }
        if (tasks.some(({ taskType }) => (taskType === tasks_1.TaskType.DeferredEnsureBuildings
            || taskType === tasks_1.TaskType.DeferredDeleteIrrelevantBuildings
            || taskType === tasks_1.TaskType.EnsureBuildings
            // || taskType === TaskType.DeleteIrrelevantBuildings
            || taskType === tasks_1.TaskType.DeferredEnsureRooms
            || taskType === tasks_1.TaskType.DeferredDeleteIrrelevantRooms
            || taskType === tasks_1.TaskType.EnsureRooms
            // || taskType === TaskType.DeleteIrrelevantRooms
            || taskType === tasks_1.TaskType.DeferredEnsureGroups
            || taskType === tasks_1.TaskType.DeferredDeleteIrrelevantGroups
            || taskType === tasks_1.TaskType.EnsureGroups
            // || taskType === TaskType.DeleteIrrelevantGroups
            || taskType === tasks_1.TaskType.InitializeEventsBaseContext
            || taskType === tasks_1.TaskType.InitializeEnsureEventsContext
            || taskType === tasks_1.TaskType.InitializeRelevantEventsContext
            || taskType === tasks_1.TaskType.InitializeEnsureAndRelevantEventsContext))) {
            types.push(...(this._args
                ? jobs_1.getCistCachedClientTypesForArgs(this._args, this._config.ncgc.caching.cist.priorities)
                : jobs_1.getCistCachedClientTypes(this._config.ncgc.caching.cist.priorities)));
        }
        return types;
    }
}
exports.RunTasksJob = RunTasksJob;
function getTasksFromArgs(args) {
    const tasks = [];
    if (args.auditories) {
        tasks.push({
            taskType: tasks_1.TaskType.DeferredEnsureBuildings
        }, {
            taskType: tasks_1.TaskType.DeferredEnsureRooms
        });
    }
    if (args.deleteIrrelevantAuditories) {
        tasks.push({
            taskType: tasks_1.TaskType.DeferredDeleteIrrelevantRooms
        }, {
            taskType: tasks_1.TaskType.DeferredDeleteIrrelevantBuildings
        });
    }
    if (args.groups) {
        tasks.push({
            taskType: tasks_1.TaskType.DeferredEnsureGroups
        });
    }
    if (args.deleteIrrelevantGroups) {
        tasks.push({
            taskType: tasks_1.TaskType.DeferredDeleteIrrelevantGroups
        });
    }
    if (args.events && args.deleteIrrelevantEvents) {
        tasks.push({
            taskType: tasks_1.TaskType.DeferredEnsureAndDeleteIrrelevantEvents
        });
    }
    else if (args.events) {
        tasks.push({
            taskType: tasks_1.TaskType.DeferredEnsureEvents
        });
    }
    else if (args.deleteIrrelevantEvents) {
        tasks.push({
            taskType: tasks_1.TaskType.DeferredEnsureEvents
        });
    }
    return tasks;
}
//# sourceMappingURL=run-tasks.class.js.map