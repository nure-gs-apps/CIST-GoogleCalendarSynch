"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const inversify_1 = require("inversify");
const types_1 = require("../di/types");
let TaskStepExecutor = class TaskStepExecutor {
    constructor(container) {
        Object.defineProperty(this, "_container", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this._container = container;
    }
    requiresSteps(taskType) {
        return false;
    }
    rerunFailed(taskType, errorOrStep, error) {
        return Promise.resolve(undefined);
    }
    run(taskType, step) {
        return Promise.resolve(undefined);
    }
};
TaskStepExecutor = tslib_1.__decorate([
    inversify_1.injectable(),
    tslib_1.__param(0, inversify_1.inject(types_1.TYPES.Container)),
    tslib_1.__metadata("design:paramtypes", [Object])
], TaskStepExecutor);
exports.TaskStepExecutor = TaskStepExecutor;
//# sourceMappingURL=task-step-executor.js.map