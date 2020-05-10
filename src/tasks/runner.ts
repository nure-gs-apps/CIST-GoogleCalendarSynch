import iterate from 'iterare';
import { TaskDefinition, TaskStepExecutor } from './types';
import { cloneDeep } from 'lodash';

export class TaskRunner {
  protected readonly _taskStepExecutor: TaskStepExecutor;
  protected _tasks: TaskDefinition<any>[];
  protected _failedTasks: TaskDefinition<any>[];
  protected _isRunning: boolean;
  private _maxConcurrentSteps: number;

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
    return this._isRunning;
  }

  constructor(taskStepExecutor: TaskStepExecutor, maxConcurrentSteps = 1) {
    this._taskStepExecutor = taskStepExecutor;
    this.maxConcurrentSteps = maxConcurrentSteps; // to perform validation
    this._maxConcurrentSteps = maxConcurrentSteps; // to satisfy compiler
    this._tasks = [];
    this._failedTasks = [];
    this._isRunning = false;
  }

  enqueueTask(task: TaskDefinition<any>, clone = true) {
    const newTask = clone ? cloneDeep(task) : task;
    if (newTask.steps && newTask.steps.length > 0) {
      newTask.steps = Array.from(new Set(newTask.steps));
    }
    if (newTask.failedSteps && newTask.failedSteps.length > 0) {
      newTask.failedSteps = Array.from(new Set(newTask.failedSteps));
    }
    this._tasks.push(clone ? cloneDeep(task) : task);
  }

  hasUndoneTasks() {
    return this.getRemainingStepCount() > 0;
  }

  getRemainingStepCount() {
    return this._tasks.reduce((sum, t) => sum + (
      !t.steps || t.steps.length === 0 ? (
        t.failedSteps && t.failedSteps.length > 0 ? 0 : 1
      ) : t.steps.length
    ), 0);
  }

  async runAll() {
    for await (const _ of this.asRunnableGenerator()) {}
  }

  async* asRunnableGenerator() {
    while (this.hasUndoneTasks()) {
      yield this.runStep();
    }
  }

  runStep() {
    if (this._isRunning) {
      throw new TypeError(l('is already running'));
    }
    const index = this._tasks.findIndex(t => t.steps && t.steps.length >= 0
      || !t.failedSteps || t.failedSteps.length === 0);
    if (index < 0) {
      return Promise.resolve([]);
    }
    const task = this._tasks[index];
    let promises: Promise<any>[];
    if (task.steps && task.steps.length > 0) {
      promises = iterate(task.steps)
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
            if (!task.failedSteps || task.failedSteps.length === 0) {
              const i = this._tasks.indexOf(task);
              if (i >= 0) {
                this._tasks.splice(i, 1);
              }
            }
          }))
        .toArray();
    } else {
      promises = [
        Promise.resolve(this._taskStepExecutor.run(task.taskType)
          .catch(error => task.failedSteps = [{ error, value: null }])
          .tap(() => {
            if (!task.failedSteps || task.failedSteps.length === 0) {
              const i = this._tasks.indexOf(task);
              if (i >= 0) {
                this._tasks.splice(i, 1);
              }
            }
          })),
      ];
    }
    this._isRunning = promises.length > 0;
    return this._isRunning
      ? Promise.all(promises).tap(() => this._isRunning = false)
      : Promise.resolve([]);
  }

  async getAllUndoneTasks(clone = true) {
    return clone ? cloneDeep(this._tasks) : this._tasks;
  }

  async getUndoneTasks(clone = true) {
    let tasks = iterate(this._tasks).filter(t => (
      !!t.steps
      && t.steps.length > 0
    ) || !t.failedSteps || t.failedSteps.length === 0);
    if (clone) {
      tasks = tasks.map(cloneDeep);
    }
    return tasks.toArray();
  }

  async getFailedTasks(clone = true) {
    let tasks = iterate(this._tasks).filter(t => !!t.failedSteps
      && t.failedSteps.length > 0);
    if (clone) {
      tasks = tasks.map(cloneDeep);
    }
    return tasks.toArray();
  }

  hasFailedTasks() {
    return this.getFailedStepCount() > 0;
  }

  getFailedStepCount() {
    return this._tasks.reduce((sum, t) => sum + (
      !t.steps || t.steps.length === 0 ? 0 : t.steps.length
    ), 0);
  }

  async runAllFailed() {
    for await (const _ of this.asFailedRunnableGenerator()) {}
  }

  async* asFailedRunnableGenerator() {
    while (this.hasFailedTasks()) {
      yield this.rerunFailedStep();
    }
  }

  rerunFailedStep() {
    if (this._isRunning) {
      throw new TypeError(l('is already running'));
    }
    const index = this._tasks.findIndex(t => t.failedSteps
      && t.failedSteps.length > 0);
    if (index < 0) {
      return Promise.resolve([]);
    }
    const task = this._tasks[index];
    if (!task.failedSteps || task.failedSteps.length === 0) {
      return Promise.all([]);
    }
    const failedTask = {
      taskType: task.taskType,
      failedSteps: [] as any[],
    };
    this._failedTasks.push(failedTask);
    const hasSteps = task.steps && task.steps.length > 0;
    const promises = iterate(task.failedSteps)
      .take(this._maxConcurrentSteps)
      .map(
        s => Promise.resolve(hasSteps ? this._taskStepExecutor.rerunFailed(
          task.taskType,
          s.value,
          s.error,
        ) : this._taskStepExecutor.rerunFailed(task.taskType, s.error))
          .catch(error => {
            if (!failedTask.failedSteps) {
              return;
            }
            failedTask.failedSteps.push({
              error,
              value: hasSteps ? s : null,
            });
          })
          .tap(() => {
            if (task.failedSteps) {
              const i = task.failedSteps.indexOf(s);
              if (i >= 0) {
                task.failedSteps.splice(i, 1);
              }
            }
            if (!task.steps || task.steps.length === 0) {
              const i = this._tasks.indexOf(task);
              if (i >= 0) {
                this._tasks.splice(i, 1);
              }
            }
          }),
      )
      .toArray();
    this._isRunning = promises.length > 0;
    return this._isRunning
      ? Promise.all(promises).tap(() => this._isRunning = false)
      : Promise.resolve([]);
  }

  getDoublyFailedTaskCount() {
    return this._failedTasks.reduce((sum, t) => !!t.failedSteps
      && t.failedSteps.length > 0 ? sum + t.failedSteps.length : sum, 0);
  }

  getDoublyFailedTasks(clone = true) {
    return clone ? cloneDeep(this._failedTasks) : this._failedTasks;
  }

  enqueueDoublyFailedTasks() {
    this._tasks.push(...this._failedTasks);
  }
}

function l(message: string) {
  return `${TaskRunner.name}: ${message}`;
}
