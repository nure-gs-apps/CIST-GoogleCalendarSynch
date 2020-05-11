"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("../utils/common");
var TaskType;
(function (TaskType) {
    TaskType["EnsureBuildings"] = "ensureBuildings";
    TaskType["EnsureRooms"] = "ensureRooms";
    TaskType["EnsureGroups"] = "ensureGroups";
    TaskType["DeleteIrrelevantBuildings"] = "deleteIrrelevantBuildings";
    TaskType["DeleteIrrelevantRooms"] = "deleteIrrelevantRooms";
    TaskType["DeleteIrrelevantGroups"] = "deleteIrrelevantGroups";
})(TaskType = exports.TaskType || (exports.TaskType = {}));
function isTaskDefinition(task, 
// tslint:disable-next-line:variable-name
TGuard = () => true) {
    return common_1.isObjectLike(task)
        && typeof task.taskType === 'string'
        && (!('steps' in task)
            || Array.isArray(task.steps) && task.steps.every(TGuard))
        && (!('failedSteps' in task)
            || Array.isArray(task.failedSteps) && task.failedSteps.every(s => common_1.isObjectLike(s)
                && 'error' in s && (!('value' in s) || TGuard(s.value))));
}
exports.isTaskDefinition = isTaskDefinition;
//# sourceMappingURL=types.js.map