"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const iterare_1 = require("iterare");
const lodash_1 = require("lodash");
// FIXME: possibly add `isError` monad in run steps
class TaskRunner {
    constructor(taskStepExecutor, maxConcurrentSteps = 1) {
        Object.defineProperty(this, "_taskStepExecutor", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "_tasks", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "_failedTasks", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "_runningTask", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "_maxConcurrentSteps", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this._taskStepExecutor = taskStepExecutor;
        this.maxConcurrentSteps = maxConcurrentSteps; // to perform validation
        this._maxConcurrentSteps = maxConcurrentSteps; // to satisfy compiler
        this._tasks = [];
        this._failedTasks = [];
        this._runningTask = null;
    }
    get maxConcurrentSteps() {
        return this._maxConcurrentSteps;
    }
    set maxConcurrentSteps(value) {
        if (value <= 0) {
            throw new TypeError(l('max concurrent steps must be positive'));
        }
        this._maxConcurrentSteps = Math.trunc(value);
    }
    get isRunning() {
        return !!this._runningTask;
    }
    enqueueTask(task, clone = true) {
        if (!task.steps || task.steps.length === 0) {
            if (this._taskStepExecutor.requiresSteps(task.taskType)) {
                throw new TypeError(l(`Task with type "${task.taskType}" requires steps`));
            }
        }
        const newTask = clone ? { taskType: task.taskType } : task;
        if (task.steps && task.steps.length > 0) {
            newTask.steps = Array.from(new Set(task.steps));
        }
        if (task.failedSteps && task.failedSteps.length > 0) {
            newTask.failedSteps = task.failedSteps;
        }
        this._tasks.push(newTask);
        return this;
    }
    enqueueTasks(clone, ...tasks) {
        for (const task of tasks) {
            this.enqueueTask(task, clone);
        }
        return this;
    }
    removeTask(task) {
        if (this._runningTask === task) {
            throw new TypeError(l('cannot remove task because it is running'));
        }
        return this.doRemoveTask(task);
    }
    clearTasks() {
        if (this.isRunning) {
            throw new TypeError(l('Cannot clear tasks while running'));
        }
        this._tasks.length = 0;
    }
    clearTwiceFailedTasks() {
        this._failedTasks.length = 0;
    }
    hasUndoneTasks() {
        return this.getRemainingStepCount() > 0;
    }
    getRemainingStepCount() {
        return this._tasks.reduce((sum, t) => sum + (!t.steps || t.steps.length === 0 ? (t.failedSteps && t.failedSteps.length > 0 ? 0 : 1) : t.steps.length), 0);
    }
    async runAll() {
        for await (const _ of this.asRunnableGenerator()) { }
    }
    async *asRunnableGenerator() {
        while (this.hasUndoneTasks()) {
            yield this.runStep();
        }
    }
    runStep() {
        if (this._runningTask) {
            throw new TypeError(l('is already running'));
        }
        const index = this._tasks.findIndex(t => t.steps && t.steps.length >= 0
            || !t.failedSteps || t.failedSteps.length === 0);
        if (index < 0) {
            return Promise.resolve([]);
        }
        const task = this._tasks[index];
        let promises;
        if (task.steps && task.steps.length > 0) {
            promises = iterare_1.default(task.steps)
                .take(this._maxConcurrentSteps)
                .map(s => Promise.resolve(this._taskStepExecutor.run(task.taskType, s))
                .catch(error => {
                if (!task.failedSteps) {
                    task.failedSteps = [];
                }
                task.failedSteps.push({ error, value: s });
            })
                .tap(() => {
                if (task.steps && task.steps.length > 0) {
                    const i = task.steps.indexOf(s);
                    if (i >= 0) {
                        task.steps.splice(i, 1);
                    }
                }
                if ((!task.steps || task.steps.length === 0) && (!task.failedSteps || task.failedSteps.length === 0)) {
                    this.doRemoveTask(task);
                }
            }))
                .toArray();
        }
        else {
            promises = [
                Promise.resolve(this._taskStepExecutor.run(task.taskType)
                    .catch(error => task.failedSteps = [{ error }])
                    .tap(() => {
                    if (!task.failedSteps || task.failedSteps.length === 0) {
                        this.doRemoveTask(task);
                    }
                })),
            ];
        }
        this._runningTask = task;
        return this._runningTask
            ? Promise.all(promises).tap(() => this._runningTask = null)
            : Promise.resolve([]);
    }
    async getAllUndoneTasks(clone = true) {
        return clone ? lodash_1.cloneDeep(this._tasks) : this._tasks;
    }
    async getUndoneTasks(clone = true) {
        let tasks = iterare_1.default(this._tasks).filter(t => (!!t.steps
            && t.steps.length > 0) || !t.failedSteps || t.failedSteps.length === 0);
        if (clone) {
            tasks = tasks.map(lodash_1.cloneDeep);
        }
        return tasks.toArray();
    }
    async getFailedTasks(clone = true) {
        let tasks = iterare_1.default(this._tasks).filter(t => !!t.failedSteps
            && t.failedSteps.length > 0);
        if (clone) {
            tasks = tasks.map(lodash_1.cloneDeep);
        }
        return tasks.toArray();
    }
    hasFailedTasks() {
        return this.getFailedStepCount() > 0;
    }
    getFailedStepCount() {
        return this._tasks.reduce((sum, t) => sum + (!t.failedSteps || t.failedSteps.length === 0 ? 0 : t.failedSteps.length), 0);
    }
    async runAllFailed() {
        for await (const _ of this.asFailedRunnableGenerator()) { }
    }
    async *asFailedRunnableGenerator() {
        while (this.hasFailedTasks()) {
            yield this.rerunFailedStep();
        }
    }
    rerunFailedStep() {
        if (this._runningTask) {
            throw new TypeError(l('is already running'));
        }
        const index = this._tasks.findIndex(t => t.failedSteps
            && t.failedSteps.length > 0);
        if (index < 0) {
            return Promise.resolve([]);
        }
        const task = this._tasks[index];
        if (!task.failedSteps || task.failedSteps.length === 0) {
            return Promise.resolve([]);
        }
        const failedSteps = [];
        const promises = iterare_1.default(task.failedSteps)
            .take(this._maxConcurrentSteps)
            .map(s => Promise.resolve('value' in s ? this._taskStepExecutor.rerunFailed(task.taskType, s.value, s.error) : this._taskStepExecutor.rerunFailed(task.taskType, s.error))
            .catch(error => {
            const failedStep = { error };
            if ('value' in s) {
                failedStep.value = s.value;
            }
            failedSteps.push(failedStep);
        })
            .tap(() => {
            if (task.failedSteps) {
                const i = task.failedSteps.indexOf(s);
                if (i >= 0) {
                    task.failedSteps.splice(i, 1);
                }
            }
            if ((!task.failedSteps || task.failedSteps.length === 0) && (!task.steps || task.steps.length === 0)) {
                this.doRemoveTask(task);
            }
        }))
            .toArray();
        this._runningTask = task;
        return this._runningTask
            ? Promise.all(promises).tap(() => {
                this._runningTask = null;
                if (failedSteps.length >= 0) {
                    this._failedTasks.push({
                        failedSteps,
                        taskType: task.taskType
                    });
                }
            })
            : Promise.resolve([]);
    }
    hasTwiceFailedTasks() {
        return this.getTwiceFailedStepCount() > 0;
    }
    getTwiceFailedStepCount() {
        return this._failedTasks.reduce((sum, t) => !!t.failedSteps
            && t.failedSteps.length > 0 ? sum + t.failedSteps.length : sum, 0);
    }
    getTwiceFailedTasks(clone = true) {
        return clone ? lodash_1.cloneDeep(this._failedTasks) : this._failedTasks;
    }
    enqueueAllTwiceFailedTasksAndClear() {
        this._tasks.push(...this._failedTasks);
        this.clearTwiceFailedTasks();
    }
    doRemoveTask(task) {
        const i = this._tasks.indexOf(task);
        if (i >= 0) {
            this._tasks.splice(i, 1);
            return true;
        }
        return false;
    }
}
exports.TaskRunner = TaskRunner;
function l(message) {
    return `${TaskRunner.name}: ${message}`;
}
//# sourceMappingURL=runner.js.map