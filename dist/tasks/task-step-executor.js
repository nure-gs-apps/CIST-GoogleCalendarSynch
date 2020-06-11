"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const lib_1 = require("async-sema/lib");
const events_1 = require("events");
const inversify_1 = require("inversify");
const object_1 = require("../@types/object");
const tasks_1 = require("../@types/tasks");
const types_1 = require("../di/types");
const errors_1 = require("../services/google/errors");
var TaskStepExecutorEventNames;
(function (TaskStepExecutorEventNames) {
    TaskStepExecutorEventNames["NewTask"] = "new-task";
})(TaskStepExecutorEventNames = exports.TaskStepExecutorEventNames || (exports.TaskStepExecutorEventNames = {}));
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
        this._container = container;
        this._logger = logger;
        this._disposer = new object_1.Disposer(this.doDispose.bind(this));
        this._buildingsService = null;
        this._roomsService = null;
        this._groupsService = null;
        this._cistClient = null;
        this._buildingsContext = null;
        this._roomsContext = null;
        this._groupsContext = null;
        this._buildingsContextSemaphore = null;
        this._roomsContextSemaphore = null;
        this._groupsContextSemaphore = null;
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
                return false;
            default:
                return true;
        }
    }
    taskComparator(first, other) {
        if ((first.taskType === tasks_1.TaskType.EnsureBuildings
            && other.taskType === tasks_1.TaskType.EnsureRooms)
            || (first.taskType === tasks_1.TaskType.DeferredEnsureBuildings
                && other.taskType === tasks_1.TaskType.DeferredEnsureRooms)
            || (first.taskType === tasks_1.TaskType.DeleteIrrelevantRooms
                && other.taskType === tasks_1.TaskType.DeleteIrrelevantBuildings)
            || (first.taskType === tasks_1.TaskType.DeferredDeleteIrrelevantRooms
                && other.taskType === tasks_1.TaskType.DeferredDeleteIrrelevantBuildings)) {
            return -1;
        }
        if ((first.taskType === tasks_1.TaskType.EnsureRooms
            && other.taskType === tasks_1.TaskType.EnsureBuildings)
            || (first.taskType === tasks_1.TaskType.DeferredEnsureRooms
                && other.taskType === tasks_1.TaskType.DeferredEnsureBuildings)
            || (first.taskType === tasks_1.TaskType.DeleteIrrelevantBuildings
                && other.taskType === tasks_1.TaskType.DeleteIrrelevantRooms)
            || (first.taskType === tasks_1.TaskType.DeferredDeleteIrrelevantBuildings
                && other.taskType === tasks_1.TaskType.DeferredDeleteIrrelevantRooms)) {
            return 1;
        }
        return 0;
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
        var _a, _b, _c, _d, _e, _f;
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
    dispose() {
        return this._disposer.dispose();
    }
    doDispose() {
        const promises = [];
        this._buildingsContext = null;
        if (this._cistClient && object_1.isDisposable(this._cistClient)) {
            promises.push(this._cistClient.dispose());
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
function l(message) {
    return `${TaskStepExecutor.name}: ${message}`;
}
//# sourceMappingURL=task-step-executor.js.map