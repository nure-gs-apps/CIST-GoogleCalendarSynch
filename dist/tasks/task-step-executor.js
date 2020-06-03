"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const events_1 = require("events");
const inversify_1 = require("inversify");
const tasks_1 = require("../@types/tasks");
const types_1 = require("../di/types");
const errors_1 = require("../services/google/errors");
var EventNames;
(function (EventNames) {
    EventNames["NewTask"] = "new-task";
})(EventNames = exports.EventNames || (exports.EventNames = {}));
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
        Object.defineProperty(this, "_buildingsService", {
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
        }); // FIXME: probably, use cahced value with expiration
        this._container = container;
        this._logger = logger;
        this._buildingsService = null;
        this._cistClient = null;
        this._buildingsContext = null;
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
    rerunFailed(taskType, errorOrStep, error) {
        return Promise.resolve(undefined);
    }
    async run(taskType, step) {
        var _a, _b;
        switch (taskType) {
            case tasks_1.TaskType.DeferredEnsureBuildings:
                {
                    assertNoStep(step);
                    const roomsResponse = await this.getCistClient().getRoomsResponse();
                    this.emit(EventNames.NewTask, this.getBuildingsService().createEnsureBuildingsTask(roomsResponse));
                }
                break;
            case tasks_1.TaskType.DeferredDeleteIrrelevantBuildings:
                {
                    assertNoStep(step);
                    this.emit(EventNames.NewTask, this.getBuildingsService().createDeleteIrrelevantTask((_a = this._buildingsContext) !== null && _a !== void 0 ? _a : await this.saveAndGetBuildingsContext(await this.getCistClient().getRoomsResponse())));
                }
                break;
            case tasks_1.TaskType.EnsureBuildings:
                {
                    assertTaskStep(step);
                    if (typeof step !== 'string') {
                        throw new errors_1.FatalError(l('Google Building ID must be string'));
                    }
                    await this.getBuildingsService().ensureBuilding(step, ((_b = this._buildingsContext) !== null && _b !== void 0 ? _b : await this.saveAndGetBuildingsContext(await this.getCistClient().getRoomsResponse())));
                }
                break;
            case tasks_1.TaskType.DeleteIrrelevantBuildings:
                {
                    assertGoogleBuildingId(step);
                    await this.getBuildingsService().deleteBuildingById(step);
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
        if (!this._buildingsContext) {
            this._buildingsContext = await this.getBuildingsService()
                .createBuildingsContext(roomsResponse);
        }
        return this._buildingsContext;
    }
    getBuildingsService() {
        if (!this._buildingsService) {
            this._buildingsService = this._container.get(types_1.TYPES.BuildingsService);
        }
        return this._buildingsService;
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