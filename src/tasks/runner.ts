import iterate from 'iterare';
import { Nullable } from '../@types';
import {
  ITaskDefinition,
  ITaskFailedStep,
  ITaskStepExecutor,
} from '../@types/tasks';
import { cloneDeep } from 'lodash';

export interface ITaskStepExecutionResult {
  isError: boolean;
  value: any;
  taskType: string;
  step?: any;
}

export interface ITaskErrorStepExecutionResult extends ITaskStepExecutionResult {
  error: any;
}

// FIXME: possibly add `isError` monad in run steps
export class TaskRunner {
  protected readonly _taskStepExecutor: ITaskStepExecutor;
  protected readonly _tasks: ITaskDefinition<any>[];
  protected readonly _failedTasks: ITaskDefinition<any>[];
  protected _runningTask: Nullable<ITaskDefinition<any>>;
  protected _twiceFailedTask: Nullable<ITaskDefinition<any>>;
  protected _runningFailedTask: Nullable<ITaskDefinition<any>>;
  protected _runningPromise: Nullable<Promise<any[]>>;
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

  get runningPromise() {
    return this._runningPromise ?? Promise.resolve([]);
  }

  constructor(taskStepExecutor: ITaskStepExecutor, maxConcurrentSteps = 1) {
    this._taskStepExecutor = taskStepExecutor;
    if (maxConcurrentSteps < 1 || !Number.isInteger(maxConcurrentSteps)) {
      throw new TypeError(`${TaskRunner.name}: concurrency must be a positive integer, found ${maxConcurrentSteps}`);
    }
    this.maxConcurrentSteps = maxConcurrentSteps; // to perform validation
    this._maxConcurrentSteps = maxConcurrentSteps; // to satisfy compiler
    this._tasks = [];
    this._failedTasks = [];
    this._runningTask = null;
    this._runningFailedTask = null;
    this._twiceFailedTask = null;
    this._runningPromise = null;
  }

  enqueueTasks(clone: boolean, ...tasks: ITaskDefinition<any>[]) {
    // if (this._runningPromise && this._taskStepExecutor.taskComparator) {
    //   throwReorderTasks();
    // }
    for (const task of tasks) {
      this.doEnqueueTask(task, clone);
    }
    this.ensureTaskOrder();
    return this;
  }

  enqueueTask(task: ITaskDefinition<any>, clone = true) {
    // if (this._runningPromise && this._taskStepExecutor.taskComparator) {
    //   throwReorderTasks();
    // }
    this.doEnqueueTask(task, clone);
    this.ensureTaskOrder();
    return this;
  }

  removeTask(task: ITaskDefinition<any>) {
    if (this._runningTask === task) {
      throw new TypeError(l('cannot remove task because it is running'));
    }
    return this.doRemoveTask(task);
  }

  clearTasks() {
    if (this._runningPromise) {
      throw new TypeError(l('Cannot clear tasks while running'));
    }
    this._tasks.length = 0;
  }

  clearTwiceFailedTasks() {
    this._failedTasks.length = 0;
  }

  ensureTaskOrder() {
    // if (this._runningPromise) {
    //   throwReorderTasks();
    // }
    if (this._taskStepExecutor) {
      this._tasks.sort(this._taskStepExecutor.taskComparator);
    }
  }

  includesTask(taskType: string) {
    return this._tasks.some(t => t.taskType === taskType);
  }

  hasAnyTasks() {
    return this.hasEnqueuedTasks()
      || this.hasTwiceFailedTasks();
  }

  hasEnqueuedTasks() {
    return this._tasks.length > 0;
  }

  getEnqueuedStepCount() {
    return this.getRemainingStepCount() + this.getFailedStepCount();
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

  runStep(): Promise<ITaskStepExecutionResult[]> {
    if (this._runningTask) {
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
          .then(value => {
            if (task.steps && task.steps.length > 0) {
              const i = task.steps.indexOf(s);
              if (i >= 0) {
                task.steps.splice(i, 1);
              }
            }
            if ((
              !task.steps || task.steps.length === 0
            ) && (
              !task.failedSteps || task.failedSteps.length === 0
            )) {
              if (task.steps && task.steps.length === 0) {
                delete task.steps;
              }
              this.doRemoveTask(task);
            }
            return {
              value,
              isError: false,
              taskType: task.taskType,
              step: s,
            } as ITaskStepExecutionResult;
          })
          .catch(error => {
            if (!task.failedSteps) {
              task.failedSteps = [];
            }
            task.failedSteps.push({ error, value: s });
            return {
              isError: true,
              value: error,
              taskType: task.taskType,
              step: s,
            } as ITaskStepExecutionResult;
          }))
        .toArray();
    } else {
      promises = [
        Promise.resolve(this._taskStepExecutor.run(task.taskType))
          .then(value => {
            if (!task.failedSteps || task.failedSteps.length === 0) {
              this.doRemoveTask(task);
            }
            return {
              value,
              isError: false,
              taskType: task.taskType,
            } as ITaskStepExecutionResult;
          })
          .catch(error => {
            task.failedSteps = [{ error }];
            return {
              isError: true,
              value: error,
              taskType: task.taskType,
            } as ITaskStepExecutionResult;
          }),
      ];
    }
    this._runningTask = task;
    this._runningPromise = Promise.all(promises).tap(() => {
      this._runningTask = null;
      this._runningPromise = null;
    }) as any; // Probably some bug (error "Type instantiation too deep"), so cast is required
    return this._runningPromise as any; // Probably some bug (error "Type instantiation too deep"), so cast is required
  }

  getAllUndoneTasks(clone = true) {
    return clone ? cloneDeep(this._tasks) : this._tasks;
  }

  getUndoneTasks(clone = true) {
    let tasks = iterate(this._tasks).filter(t => (
      !!t.steps
      && t.steps.length > 0
    ) || !t.failedSteps || t.failedSteps.length === 0);
    if (clone) {
      tasks = tasks.map(cloneDeep);
    }
    return tasks.toArray();
  }

  getFailedTasks(clone = true) {
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
      !t.failedSteps || t.failedSteps.length === 0 ? 0 : t.failedSteps.length
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

  rerunFailedStep(): Promise<ITaskStepExecutionResult[]> {
    if (this._runningTask) {
      throw new TypeError(l('is already running'));
    }
    const index = this._tasks.findIndex(t => t.failedSteps
      && t.failedSteps.length > 0);
    if (index < 0) {
      return Promise.resolve([]);
    }
    const task = this._tasks[index];
    if (this._runningFailedTask !== task) {
      this.flushFailedTask();
    }
    if (!task.failedSteps || task.failedSteps.length === 0) {
      return Promise.resolve([]);
    }
    const failedSteps = this._twiceFailedTask?.failedSteps ?? [];
    const promises = iterate(task.failedSteps)
      .take(this._maxConcurrentSteps)
      .map(
        s => Promise.resolve('value' in s ? this._taskStepExecutor.rerunFailed(
          task.taskType,
          s.value,
          s.error,
        ) : this._taskStepExecutor.rerunFailed(task.taskType, s.error))
          .then(value => {
            if (task.failedSteps) {
              const i = task.failedSteps.indexOf(s);
              if (i >= 0) {
                task.failedSteps.splice(i, 1);
              }
            }
            if ((
              !task.failedSteps || task.failedSteps.length === 0
            ) && (
              !task.steps || task.steps.length === 0
            )) {
              this.doRemoveTask(task);
            }
            const result: ITaskErrorStepExecutionResult = {
              value,
              isError: false,
              taskType: task.taskType,
              error: s.error
            };
            if ('value' in s) {
              result.step = s.value;
            }
            return result;
          })
          .catch(error => {
            const failedStep = { error } as ITaskFailedStep<any>;
            if ('value' in s) {
              failedStep.value = s.value;
            }
            failedSteps.push(failedStep);
            if (!this._twiceFailedTask) {
              this._twiceFailedTask = {
                failedSteps,
                taskType: task.taskType
              };
              this._failedTasks.push(this._twiceFailedTask);
              this._runningFailedTask = this._runningTask;
            }
            const result: ITaskErrorStepExecutionResult = {
              isError: true,
              value: error,
              taskType: task.taskType,
              error: s.error
            };
            if ('value' in s) {
              result.step = s.value;
            }
            return result;
          }),
      )
      .toArray();
    this._runningTask = task;
    this._runningPromise = Promise.all(promises).tap(() => {
      this._runningTask = null;
      this._runningPromise = null;
    }) as any; // Probably some bug (error "Type instantiation too deep"), so cast is required
    return this._runningPromise as any; // Probably some bug (error "Type instantiation too deep"), so cast is required
  }

  hasTwiceFailedTasks() {
    return this.getTwiceFailedStepCount() > 0;
  }

  getTwiceFailedStepCount() {
    return this._failedTasks.reduce((sum, t) => !!t.failedSteps
      && t.failedSteps.length > 0 ? sum + t.failedSteps.length : sum, 0);
  }

  getTwiceFailedTasks(clone = true) {
    return clone ? cloneDeep(this._failedTasks) : this._failedTasks;
  }

  enqueueAllTwiceFailedTasksAndClear() {
    this._tasks.push(...this._failedTasks);
    this.ensureTaskOrder();
    this.clearTwiceFailedTasks();
  }

  protected doEnqueueTask(task: ITaskDefinition<any>, clone: boolean) {
    if (
      (!task.steps || task.steps.length === 0)
      && (
        !task.failedSteps
        || task.failedSteps.length === 0
        || !('value' in task.failedSteps[0])
      )
    ) {
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
  }

  protected doRemoveTask(task: ITaskDefinition<any>) {
    const i = this._tasks.indexOf(task);
    if (i >= 0) {
      this._tasks.splice(i, 1);
      if (this._runningFailedTask === task) {
        this.flushFailedTask();
      }
      return true;
    }
    return false;
  }

  protected flushFailedTask() {
    this._runningFailedTask = null;
    this._twiceFailedTask = null;
  }
}

// function throwReorderTasks(): never {
//   throw new TypeError(l('cannot reorder tasks while running'));
// }

function l(message: string) {
  return `${TaskRunner.name}: ${message}`;
}
