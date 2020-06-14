"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const lib_1 = require("async-sema/lib");
const events_1 = require("events");
const inversify_1 = require("inversify");
const cist_1 = require("../@types/cist");
const object_1 = require("../@types/object");
const tasks_1 = require("../@types/tasks");
const types_1 = require("../di/types");
const errors_1 = require("../services/google/errors");
const events_service_1 = require("../services/google/events.service");
const jobs_1 = require("../utils/jobs");
var TaskStepExecutorEventNames;
(function (TaskStepExecutorEventNames) {
    TaskStepExecutorEventNames["NewTask"] = "new-task";
})(TaskStepExecutorEventNames = exports.TaskStepExecutorEventNames || (exports.TaskStepExecutorEventNames = {}));
const taskTypesOrder = [
    [
        tasks_1.TaskType.DeferredEnsureBuildings,
        tasks_1.TaskType.DeferredDeleteIrrelevantBuildings,
        tasks_1.TaskType.DeferredEnsureGroups,
        tasks_1.TaskType.DeferredDeleteIrrelevantGroups,
        tasks_1.TaskType.DeferredEnsureRooms,
        tasks_1.TaskType.DeferredDeleteIrrelevantRooms,
        tasks_1.TaskType.EnsureBuildings,
        tasks_1.TaskType.DeleteIrrelevantRooms,
        tasks_1.TaskType.EnsureGroups,
        tasks_1.TaskType.DeleteIrrelevantGroups,
    ],
    [tasks_1.TaskType.EnsureRooms, tasks_1.TaskType.DeleteIrrelevantBuildings],
    [
        tasks_1.TaskType.DeferredEnsureEvents,
        tasks_1.TaskType.DeferredDeleteIrrelevantEvents,
        tasks_1.TaskType.DeferredEnsureAndDeleteIrrelevantEvents,
    ],
    [tasks_1.TaskType.InitializeEventsBaseContext],
    [
        tasks_1.TaskType.InitializeEnsureEventsContext,
        tasks_1.TaskType.InitializeRelevantEventsContext,
        tasks_1.TaskType.InitializeEnsureAndRelevantEventsContext,
    ],
    [
        tasks_1.TaskType.InsertEvents,
        tasks_1.TaskType.PatchEvents,
        tasks_1.TaskType.DeleteIrrelevantEvents,
    ],
    [tasks_1.TaskType.ClearEventsContext]
];
types_1.ensureInjectable(events_1.EventEmitter);
let TaskStepExecutor = class TaskStepExecutor extends events_1.EventEmitter {
    constructor(container, logger) {
        super();
        Object.defineProperty(this, "_container", {
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
        Object.defineProperty(this, "_disposer", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "_buildingsService", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "_roomsService", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "_groupsService", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "_eventsService", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "_eventsContextStorage", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "_eventContextStorage", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "_cistClient", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "_buildingsContext", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        }); // FIXME: probably, use cached value with expiration
        Object.defineProperty(this, "_buildingsContextSemaphore", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "_roomsContext", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        }); // FIXME: probably, use cached value with expiration
        Object.defineProperty(this, "_roomsContextSemaphore", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "_groupsContext", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        }); // FIXME: probably, use cached value with expiration
        Object.defineProperty(this, "_groupsContextSemaphore", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "_eventsContext", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        }); // FIXME: probably, use cached value with expiration
        Object.defineProperty(this, "_eventsContextSemaphore", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "_eventContext", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        }); // FIXME: probably, use cached value with expiration
        Object.defineProperty(this, "_eventContextSemaphore", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this._container = container;
        this._logger = logger;
        this._disposer = new object_1.Disposer(this.doDispose.bind(this));
        this._buildingsService = null;
        this._roomsService = null;
        this._groupsService = null;
        this._eventsService = null;
        this._cistClient = null;
        this._eventsContextStorage = null;
        this._eventContextStorage = null;
        this._buildingsContext = null;
        this._roomsContext = null;
        this._groupsContext = null;
        this._eventsContext = null;
        this._eventContext = null;
        this._buildingsContextSemaphore = null;
        this._roomsContextSemaphore = null;
        this._groupsContextSemaphore = null;
        this._eventsContextSemaphore = null;
        this._eventContextSemaphore = null;
    }
    get isDisposed() {
        return this._disposer.isDisposed;
    }
    requiresSteps(taskType) {
        switch (taskType) {
            case tasks_1.TaskType.DeferredEnsureBuildings:
            case tasks_1.TaskType.DeferredEnsureRooms:
            case tasks_1.TaskType.DeferredEnsureGroups:
            case tasks_1.TaskType.DeferredDeleteIrrelevantBuildings:
            case tasks_1.TaskType.DeferredDeleteIrrelevantRooms:
            case tasks_1.TaskType.DeferredDeleteIrrelevantGroups:
            case tasks_1.TaskType.DeferredEnsureEvents:
            case tasks_1.TaskType.DeferredDeleteIrrelevantEvents:
            case tasks_1.TaskType.DeferredEnsureAndDeleteIrrelevantEvents:
            case tasks_1.TaskType.InitializeEventsBaseContext:
            case tasks_1.TaskType.InsertEvents:
            case tasks_1.TaskType.PatchEvents:
            case tasks_1.TaskType.DeleteIrrelevantEvents:
            case tasks_1.TaskType.ClearEventsContext:
                return false;
            default:
                return true;
        }
    }
    taskComparator(first, other) {
        const firstIndex = taskTypesOrder.findIndex(types => types.includes(first.taskType));
        const otherIndex = taskTypesOrder.findIndex(types => types.includes(other.taskType));
        return firstIndex - otherIndex;
    }
    rerunFailed(taskType, errorOrStep, errorParam) {
        let step;
        let error;
        if (errorParam !== undefined) {
            step = errorOrStep;
            error = errorParam;
        }
        else {
            step = undefined;
            error = errorOrStep;
        }
        if (step !== undefined) {
            this._logger.error(l(`rerunning failed task "${taskType}", step ${JSON.stringify(step)}, with error`), error);
        }
        else {
            this._logger.error(l(`rerunning failed task "${taskType}", with error`), error);
        }
        return this.run(taskType, step);
    }
    async run(taskType, step) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l;
        switch (taskType) {
            case tasks_1.TaskType.DeferredEnsureBuildings:
                {
                    assertNoStep(step);
                    const roomsResponse = await this.getCistClient().getRoomsResponse();
                    this.emit(TaskStepExecutorEventNames.NewTask, this.getBuildingsService().createEnsureBuildingsTask(roomsResponse));
                }
                break;
            case tasks_1.TaskType.DeferredDeleteIrrelevantBuildings:
                {
                    assertNoStep(step);
                    this.emit(TaskStepExecutorEventNames.NewTask, this.getBuildingsService().createDeleteIrrelevantTask((_a = this._buildingsContext) !== null && _a !== void 0 ? _a : await this.saveAndGetBuildingsContext(await this.getCistClient().getRoomsResponse())));
                }
                break;
            case tasks_1.TaskType.DeferredEnsureRooms:
                {
                    assertNoStep(step);
                    const roomsResponse = await this.getCistClient().getRoomsResponse();
                    this.emit(TaskStepExecutorEventNames.NewTask, this.getRoomsService().createEnsureRoomsTask(roomsResponse));
                }
                break;
            case tasks_1.TaskType.DeferredDeleteIrrelevantRooms:
                {
                    assertNoStep(step);
                    this.emit(TaskStepExecutorEventNames.NewTask, this.getRoomsService().createDeleteIrrelevantTask((_b = this._roomsContext) !== null && _b !== void 0 ? _b : await this.saveAndGetRoomsContext(await this.getCistClient().getRoomsResponse())));
                }
                break;
            case tasks_1.TaskType.DeferredEnsureGroups:
                {
                    assertNoStep(step);
                    const groupsResponse = await this.getCistClient().getGroupsResponse();
                    this.emit(TaskStepExecutorEventNames.NewTask, this.getGroupsService().createEnsureGroupsTask(groupsResponse));
                }
                break;
            case tasks_1.TaskType.DeferredDeleteIrrelevantGroups:
                {
                    assertNoStep(step);
                    this.emit(TaskStepExecutorEventNames.NewTask, this.getGroupsService().createDeleteIrrelevantTask((_c = this._groupsContext) !== null && _c !== void 0 ? _c : await this.saveAndGetGroupsContext(await this.getCistClient().getGroupsResponse())));
                }
                break;
            case tasks_1.TaskType.EnsureBuildings:
                {
                    assertCistBuildingId(step);
                    await this.getBuildingsService().ensureBuilding(step, (_d = this._buildingsContext) !== null && _d !== void 0 ? _d : await this.saveAndGetBuildingsContext(await this.getCistClient().getRoomsResponse()));
                }
                break;
            case tasks_1.TaskType.DeleteIrrelevantBuildings:
                {
                    assertGoogleBuildingId(step);
                    await this.getBuildingsService().deleteBuildingById(step);
                }
                break;
            case tasks_1.TaskType.EnsureRooms:
                {
                    assertCistRoomId(step);
                    await this.getRoomsService().ensureRoom(step, (_e = this._roomsContext) !== null && _e !== void 0 ? _e : await this.saveAndGetRoomsContext(await this.getCistClient().getRoomsResponse()));
                }
                break;
            case tasks_1.TaskType.DeleteIrrelevantRooms:
                {
                    assertGoogleRoomId(step);
                    await this.getRoomsService().deleteRoomById(step);
                }
                break;
            case tasks_1.TaskType.EnsureGroups:
                {
                    assertCistGroupId(step);
                    await this.getGroupsService().ensureGroup(step, (_f = this._groupsContext) !== null && _f !== void 0 ? _f : await this.saveAndGetGroupsContext(await this.getCistClient().getGroupsResponse()));
                }
                break;
            case tasks_1.TaskType.DeleteIrrelevantGroups:
                {
                    assertGoogleGroupIdOrEmail(step);
                    await this.getGroupsService().deleteGroupById(step);
                }
                break;
            case tasks_1.TaskType.DeferredEnsureEvents:
            case tasks_1.TaskType.DeferredDeleteIrrelevantEvents:
            case tasks_1.TaskType.DeferredEnsureAndDeleteIrrelevantEvents:
                {
                    if (this._eventsContext) {
                        throw new TypeError(l('Usage error: events context is already created'));
                    }
                    assertNoStep(step);
                    this._eventsContext = await this.saveAndGetEventsContext(taskType);
                    this.emit(TaskStepExecutorEventNames.NewTask, this.getEventsService().createBaseContextTask());
                    if (taskType !== tasks_1.TaskType.DeferredEnsureEvents) {
                        this.emit(TaskStepExecutorEventNames.NewTask, {
                            taskType: tasks_1.TaskType.DeleteIrrelevantEvents
                        });
                    }
                    if (taskType !== tasks_1.TaskType.DeferredDeleteIrrelevantEvents) {
                        this.emit(TaskStepExecutorEventNames.NewTask, { taskType: tasks_1.TaskType.InsertEvents });
                        this.emit(TaskStepExecutorEventNames.NewTask, { taskType: tasks_1.TaskType.PatchEvents });
                    }
                    this.emit(TaskStepExecutorEventNames.NewTask, { taskType: tasks_1.TaskType.ClearEventsContext });
                }
                break;
            case tasks_1.TaskType.InitializeEventsBaseContext:
                {
                    assertNoStep(step);
                    const context = (_g = this._eventsContext) !== null && _g !== void 0 ? _g : await this.loadEventsContext();
                    const loadEventsChunk = await this.getEventsService()
                        .loadEventsByChunksToContext(context)
                        .next();
                    const events = this.getEventsService();
                    if (!loadEventsChunk.done) {
                        this.emit(TaskStepExecutorEventNames.NewTask, events.createBaseContextTask());
                    }
                    else {
                        this.emit(TaskStepExecutorEventNames.NewTask, events.createInitializeContextTask(events.getCreateContextTypeConfigByContext(context), await this.getCistClient().getGroupsResponse()));
                    }
                }
                break;
            case tasks_1.TaskType.InitializeEnsureEventsContext:
            case tasks_1.TaskType.InitializeRelevantEventsContext:
            case tasks_1.TaskType.InitializeEnsureAndRelevantEventsContext:
                {
                    assertCistGroupId(step);
                    await this.getEventsService().updateTasksContext((_h = this._eventsContext) !== null && _h !== void 0 ? _h : await this.loadEventsContext(), await this.saveAndGetEventContext(), await this.getCistClient().getEventsResponse(cist_1.TimetableType.Group, step));
                }
                break;
            case tasks_1.TaskType.InsertEvents:
                {
                    const context = (_j = this._eventsContext) !== null && _j !== void 0 ? _j : await this.loadEventsContext();
                    if (!events_service_1.isEnsureEventsTaskContext(context)) {
                        throw new TypeError(l('Unknown state for insert: events context is not for ensuring'));
                    }
                    const events = this.getEventsService();
                    if (!isEventHash(step)) {
                        if (events.canCreateInsertEventsTaskForContext(context)) {
                            this.emit(TaskStepExecutorEventNames.NewTask, events.createInsertEventsTask(context));
                        }
                    }
                    else {
                        await events.insertEvent(step, context);
                    }
                }
                break;
            case tasks_1.TaskType.PatchEvents:
                {
                    const context = (_k = this._eventsContext) !== null && _k !== void 0 ? _k : await this.loadEventsContext();
                    if (!events_service_1.isEnsureEventsTaskContext(context)) {
                        throw new TypeError(l('Unknown state for patch: events context is not for ensuring'));
                    }
                    const events = this.getEventsService();
                    if (!isEventHash(step)) {
                        if (events.canCreatePatchEventsTaskForContext(context)) {
                            this.emit(TaskStepExecutorEventNames.NewTask, events.createPatchEventsTask(context));
                        }
                    }
                    else {
                        await events.patchEvent(step, context);
                    }
                }
                break;
            case tasks_1.TaskType.DeleteIrrelevantEvents:
                {
                    const events = this.getEventsService();
                    if (!isEventHash(step)) {
                        const context = (_l = this._eventsContext) !== null && _l !== void 0 ? _l : await this.loadEventsContext();
                        if (!events_service_1.isRelevantEventsTaskContext(context)) {
                            throw new TypeError(l('Unknown state for patch: events context is not for ensuring'));
                        }
                        if (events.canCreateDeleteIrrelevantEventsTaskForContext(context)) {
                            this.emit(TaskStepExecutorEventNames.NewTask, events.createDeleteIrrelevantEventsTask(context));
                        }
                    }
                    else {
                        await events.deleteEvent(step);
                    }
                }
                break;
            case tasks_1.TaskType.ClearEventsContext:
                {
                    await this.getEventsContextStorage()
                        .clear()
                        .catch(error => this._logger.warn(l('Failed to clear events context'), error));
                }
                break;
        }
        return Promise.resolve(undefined);
    }
    getCistClient() {
        if (!this._cistClient) {
            this._cistClient = this._container.get(types_1.TYPES.CistJsonClient);
        }
        return this._cistClient;
    }
    async saveAndGetBuildingsContext(roomsResponse) {
        if (!this._buildingsContextSemaphore) {
            this._buildingsContextSemaphore = new lib_1.Sema(1);
        }
        try {
            await this._buildingsContextSemaphore.acquire();
            if (!this._buildingsContext) {
                this._buildingsContext = await this.getBuildingsService()
                    .createBuildingsContext(roomsResponse);
            }
            return this._buildingsContext;
        }
        finally {
            this._buildingsContextSemaphore.release();
        }
    }
    async saveAndGetRoomsContext(roomsResponse) {
        if (!this._roomsContextSemaphore) {
            this._roomsContextSemaphore = new lib_1.Sema(1);
        }
        try {
            await this._roomsContextSemaphore.acquire();
            if (!this._roomsContext) {
                this._roomsContext = await this.getRoomsService()
                    .createRoomsContext(roomsResponse);
            }
            return this._roomsContext;
        }
        finally {
            this._roomsContextSemaphore.release();
        }
    }
    async saveAndGetGroupsContext(groupsResponse) {
        if (!this._groupsContextSemaphore) {
            this._groupsContextSemaphore = new lib_1.Sema(1);
        }
        try {
            await this._groupsContextSemaphore.acquire();
            if (!this._groupsContext) {
                this._groupsContext = await this.getGroupsService()
                    .createGroupsTaskContext(groupsResponse);
            }
            return this._groupsContext;
        }
        finally {
            this._groupsContextSemaphore.release();
        }
    }
    async saveAndGetEventsContext(taskType) {
        const semaphore = this.getEventsContextSemaphore();
        try {
            await semaphore.acquire();
            if (!this._eventsContext) {
                const events = this.getEventsService();
                this._eventsContext = events.createEventsTaskContext(events.getCreateContextTypeConfigByTaskType(taskType));
            }
            return this._eventsContext;
        }
        finally {
            semaphore.release();
        }
    }
    getBuildingsService() {
        if (!this._buildingsService) {
            this._buildingsService = this._container.get(types_1.TYPES.BuildingsService);
        }
        return this._buildingsService;
    }
    getRoomsService() {
        if (!this._roomsService) {
            this._roomsService = this._container.get(types_1.TYPES.RoomsService);
        }
        return this._roomsService;
    }
    getGroupsService() {
        if (!this._groupsService) {
            this._groupsService = this._container.get(types_1.TYPES.GroupsService);
        }
        return this._groupsService;
    }
    getEventsService() {
        if (!this._eventsService) {
            this._eventsService = this._container.get(types_1.TYPES.EventsService);
        }
        return this._eventsService;
    }
    getEventsContextStorage() {
        if (!this._eventsContextStorage) {
            this._eventsContextStorage = this._container
                .get(types_1.TYPES.GoogleCalendarEventsTaskContextStorage);
        }
        return this._eventsContextStorage;
    }
    async saveAndGetEventContext() {
        if (!this._eventContextSemaphore) {
            this._eventContextSemaphore = new lib_1.Sema(1);
        }
        try {
            await this._eventContextSemaphore.acquire();
            if (!this._eventContext) {
                this._eventContext =
                    await this.getEventContextService().createGeneralContext();
            }
            return this._eventContext;
        }
        finally {
            this._eventContextSemaphore.release();
        }
    }
    getEventContextService() {
        if (!this._eventContextStorage) {
            this._eventContextStorage = this._container
                .get(types_1.TYPES.GoogleEventContextService);
        }
        return this._eventContextStorage;
    }
    async loadEventsContext() {
        const semaphore = this.getEventsContextSemaphore();
        try {
            await semaphore.acquire();
            if (!this._eventsContext) {
                this._eventsContext = await this.getEventsContextStorage().load();
            }
            return this._eventsContext;
        }
        finally {
            semaphore.release();
        }
    }
    getEventsContextSemaphore() {
        if (!this._eventsContextSemaphore) {
            this._eventsContextSemaphore = new lib_1.Sema(1);
        }
        return this._eventsContextSemaphore;
    }
    dispose() {
        return this._disposer.dispose();
    }
    doDispose() {
        const promises = [];
        this._buildingsContext = null;
        if (this._cistClient && object_1.isDisposable(this._cistClient)) {
            promises.push(this._cistClient.dispose());
        }
        if (this._eventsContext) {
            promises.push(this.getEventsContextStorage().save(this._eventsContext));
        }
        this._cistClient = null;
        this._buildingsService = null;
        return Promise.all(promises);
    }
};
TaskStepExecutor = tslib_1.__decorate([
    inversify_1.injectable(),
    tslib_1.__param(0, inversify_1.inject(types_1.TYPES.Container)),
    tslib_1.__param(1, inversify_1.inject(types_1.TYPES.Logger)),
    tslib_1.__metadata("design:paramtypes", [Object, Object])
], TaskStepExecutor);
exports.TaskStepExecutor = TaskStepExecutor;
function getRequiredServicesFromTasks(tasks, cistCachePriorities, cistEntitiesToOperateOn) {
    const types = [types_1.TYPES.TaskStepExecutor];
    if (tasks.some(({ taskType }) => (taskType === tasks_1.TaskType.DeferredDeleteIrrelevantBuildings
        || taskType === tasks_1.TaskType.DeferredEnsureBuildings
        || taskType === tasks_1.TaskType.EnsureBuildings
        || taskType === tasks_1.TaskType.DeleteIrrelevantBuildings))) {
        types.push(types_1.TYPES.BuildingsService);
    }
    if (tasks.some(({ taskType }) => (taskType === tasks_1.TaskType.DeferredDeleteIrrelevantRooms
        || taskType === tasks_1.TaskType.DeferredEnsureRooms
        || taskType === tasks_1.TaskType.EnsureRooms
        || taskType === tasks_1.TaskType.DeleteIrrelevantRooms))) {
        types.push(types_1.TYPES.RoomsService);
    }
    if (tasks.some(({ taskType }) => (taskType === tasks_1.TaskType.DeferredDeleteIrrelevantGroups
        || taskType === tasks_1.TaskType.DeferredEnsureGroups
        || taskType === tasks_1.TaskType.EnsureGroups
        || taskType === tasks_1.TaskType.DeleteIrrelevantGroups))) {
        types.push(types_1.TYPES.GroupsService);
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
        types.push(types_1.TYPES.EventsService);
    }
    if (tasks.some(({ taskType, steps }) => (taskType === tasks_1.TaskType.DeferredEnsureEvents
        || taskType === tasks_1.TaskType.DeferredDeleteIrrelevantEvents
        || taskType === tasks_1.TaskType.DeferredEnsureAndDeleteIrrelevantEvents
        || taskType === tasks_1.TaskType.InitializeEventsBaseContext
        || taskType === tasks_1.TaskType.InitializeEnsureEventsContext
        || taskType === tasks_1.TaskType.InitializeRelevantEventsContext
        || taskType === tasks_1.TaskType.InitializeEnsureAndRelevantEventsContext
        || taskType === tasks_1.TaskType.InsertEvents
        || taskType === tasks_1.TaskType.PatchEvents
        || (taskType === tasks_1.TaskType.DeleteIrrelevantEvents
            && (!steps || steps.length === 0))
        || taskType === tasks_1.TaskType.ClearEventsContext))) {
        types.push(types_1.TYPES.GoogleCalendarEventsTaskContextStorage);
    }
    if (tasks.some(({ taskType }) => (taskType === tasks_1.TaskType.InitializeEnsureEventsContext
        || taskType === tasks_1.TaskType.InitializeRelevantEventsContext
        || taskType === tasks_1.TaskType.InitializeEnsureAndRelevantEventsContext))) {
        types.push(types_1.TYPES.GoogleEventContextService);
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
        types.push(...(cistEntitiesToOperateOn
            ? jobs_1.getCistCachedClientTypesForArgs({
                auditories: cistEntitiesToOperateOn.auditories,
                groups: cistEntitiesToOperateOn.groups
                    || tasks.some(({ taskType }) => (taskType === tasks_1.TaskType.InitializeEventsBaseContext)),
                events: cistEntitiesToOperateOn.events
                    || tasks.some(({ taskType }) => (taskType === tasks_1.TaskType.InitializeEnsureEventsContext
                        || taskType === tasks_1.TaskType.InitializeRelevantEventsContext
                        || taskType === tasks_1.TaskType.InitializeEnsureAndRelevantEventsContext)),
            }, cistCachePriorities)
            : jobs_1.getCistCachedClientTypes(cistCachePriorities)));
    }
    return types;
}
exports.getRequiredServicesFromTasks = getRequiredServicesFromTasks;
function assertGoogleBuildingId(step) {
    assertTaskStep(step);
    if (typeof step !== 'string') {
        throw new errors_1.FatalError(l('Google Building ID must be string'));
    }
}
function assertCistBuildingId(step) {
    assertTaskStep(step);
    if (typeof step !== 'string') {
        throw new errors_1.FatalError(l('CIST Building ID must be string'));
    }
}
function assertGoogleRoomId(step) {
    assertTaskStep(step);
    if (typeof step !== 'string') {
        throw new errors_1.FatalError(l('Google Room (resource) ID must be string'));
    }
}
function assertCistRoomId(step) {
    assertTaskStep(step);
    if (typeof step !== 'string') {
        throw new errors_1.FatalError(l('CIST Room ID must be string'));
    }
}
function assertGoogleGroupIdOrEmail(step) {
    assertTaskStep(step);
    if (typeof step !== 'string') {
        throw new errors_1.FatalError(l('Google Group ID must be string'));
    }
}
function assertCistGroupId(step) {
    assertTaskStep(step);
    if (typeof step !== 'number') {
        throw new errors_1.FatalError(l('CIST Group ID must be number'));
    }
}
function assertTaskStep(step) {
    if (step === undefined) {
        throw new TypeError(l('step is not found'));
    }
}
function assertNoStep(step) {
    if (step !== undefined) {
        throw new TypeError(l('step is not needed'));
    }
}
function isEventHash(step) {
    return typeof step === 'string';
}
function l(message) {
    return `${TaskStepExecutor.name}: ${message}`;
}
//# sourceMappingURL=task-step-executor.js.map