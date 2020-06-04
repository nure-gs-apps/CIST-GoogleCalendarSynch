"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tasks_1 = require("../../@types/tasks");
const types_1 = require("../../di/types");
function getTaskProgressBackend(context) {
    let type = context.container.get(types_1.TYPES.TaskProgressFileBackendType);
    if (!tasks_1.taskProgressBackendValues.includes(type)) {
        type = tasks_1.defaultTaskProgressBackend;
    }
    switch (type) {
        case tasks_1.TaskProgressBackend.File:
            return context.container.get(types_1.TYPES.TaskProgressFileBackend);
    }
}
exports.getTaskProgressBackend = getTaskProgressBackend;
//# sourceMappingURL=di.js.map