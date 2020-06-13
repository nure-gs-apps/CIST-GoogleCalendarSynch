"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("../utils/common");
var TaskType;
(function (TaskType) {
    TaskType["DeferredEnsureBuildings"] = "deferredEnsureBuildings";
    TaskType["DeferredEnsureRooms"] = "deferredEnsureRooms";
    TaskType["DeferredEnsureGroups"] = "deferredEnsureGroups";
    TaskType["DeferredEnsureEvents"] = "deferredEnsureEvents";
    TaskType["DeferredDeleteIrrelevantBuildings"] = "deferredDeleteIrrelevantBuildings";
    TaskType["DeferredDeleteIrrelevantRooms"] = "deferredDeleteIrrelevantRooms";
    TaskType["DeferredDeleteIrrelevantGroups"] = "deferredDeleteIrrelevantGroups";
    TaskType["DeferredDeleteIrrelevantEvents"] = "deferredDeleteIrrelevantEvents";
    TaskType["CreateEventsBaseContext"] = "createEventsContext.base";
    TaskType["CreateEnsureEventsContext"] = "createEventsContext.ensure";
    TaskType["CreateDeleteIrrelevantEventsContext"] = "createEventsContext.deleteIrrelevant";
    TaskType["CreateEnsureAndDeleteIrrelevantEventsContext"] = "createEventsContext.ensure+deleteIrrelevant";
    TaskType["EnsureBuildings"] = "ensureBuildings";
    TaskType["EnsureRooms"] = "ensureRooms";
    TaskType["EnsureGroups"] = "ensureGroups";
    TaskType["InsertEvents"] = "insertEvents";
    TaskType["PatchEvents"] = "patchEvents";
    TaskType["DeleteIrrelevantBuildings"] = "deleteIrrelevantBuildings";
    TaskType["DeleteIrrelevantRooms"] = "deleteIrrelevantRooms";
    TaskType["DeleteIrrelevantGroups"] = "deleteIrrelevantGroups";
    TaskType["DeleteIrrelevantEvents"] = "deleteIrrelevantEvents";
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
var TaskProgressBackend;
(function (TaskProgressBackend) {
    TaskProgressBackend["File"] = "file";
})(TaskProgressBackend = exports.TaskProgressBackend || (exports.TaskProgressBackend = {}));
exports.taskProgressBackendValues = Object.values(TaskProgressBackend);
exports.defaultTaskProgressBackend = TaskProgressBackend.File;
//# sourceMappingURL=tasks.js.map