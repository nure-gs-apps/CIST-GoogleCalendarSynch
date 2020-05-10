import iterate from 'iterare';
import { Nullable } from '../@types';
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

  hasUndoneTasks() {
    return this.getRemainingSteps() > 0;
  }

  getRemainingSteps() {
    return this._tasks.reduce((sum, t) => sum + (
      !t.steps || t.steps.length === 0 ? (
        t.failedSteps && t.failedSteps.length > 0 ? 0 : 1
      ) : t.steps.length
    ), 0);
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
            if (task.steps) {
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
          .then(() => {
            const i = this._tasks.indexOf(task);
            if (i >= 0) {
              this._tasks.splice(i, 1);
            }
          })),
      ];
    }
    this._isRunning = promises.length > 0;
    return this._isRunning
      ? Promise.all(promises).tap(() => this._isRunning = false)
      : Promise.resolve([]);
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
    let failedTask = this._failedTasks.find(
      t => t.taskType === task.taskType,
    ) ?? null;
    if (!failedTask) {
      failedTask = {
        taskType: task.taskType,
        failedSteps: [],
      };
      this._failedTasks.push(failedTask);
    } else {
      failedTask.failedSteps = [];
    }
    if (task.steps) {
      failedTask.steps = task.steps;
    }
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
            if (!failedTask || !failedTask.failedSteps) {
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

  async getUndoneTasks(clone = true) {
    return clone ? cloneDeep(this._tasks) : this._tasks;
  }
}

function l(message: string) {
  return `${TaskRunner.name}: ${message}`;
}
