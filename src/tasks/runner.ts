import { TaskDefinition } from './types';
import { cloneDeep } from 'lodash';

export class TaskRunner { // TODO: rerun methods for failed, and getters
  protected _tasks: TaskDefinition<any>[];
  private _maxConcurrentSteps: number;
  private _isRunning: boolean;

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

  constructor(maxConcurrentSteps = 1) {
    this._maxConcurrentSteps = maxConcurrentSteps;
    this._tasks = [];
    this._isRunning = false;
  }

  hasUndoneTasks() {
    return this.getRemainingSteps() > 0;
  }

  getRemainingSteps() {
    return this._tasks.reduce((sum, t) => (
      sum + (!t.steps || t.steps.length === 0 ? 1 : t.steps.length)
      // + (
      //   !t.failedSteps || t.failedSteps.length === 0 ? 1 : t.failedSteps.length
      // )
    ), 0);
  }

  enqueueTask(task: TaskDefinition<any>, clone = true) {
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
      promises = task.steps.slice(
        0,
        this._maxConcurrentSteps,
      ) as any;
      // TODO: get run Bluebird promise; catch error and put into failed or remove from _task using splice and in case of empty task - remove the task or reschedule it if any failed
      if (task.steps.length >= this._maxConcurrentSteps) {
        // TODO: fully loaded, don't remove tasks
      }
    } else {
      // TODO: get run Bluebird promise; catch error and put into failed or remove from _task using splice or reschedule it if any failed
      promises = [task] as any;
    }
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
