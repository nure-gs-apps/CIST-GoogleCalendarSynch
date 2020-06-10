import { isObjectLike } from '../utils/common';
import { DeepReadonlyArray } from './index';

export enum TaskType {
  DeferredEnsureBuildings= 'deferredEnsureBuildings',
  DeferredEnsureRooms = 'deferredEnsureRooms',
  DeferredEnsureGroups = 'deferredEnsureGroups',

  DeferredDeleteIrrelevantBuildings = 'deferredDeleteIrrelevantBuildings',
  DeferredDeleteIrrelevantRooms = 'deferredDeleteIrrelevantRooms',
  DeferredDeleteIrrelevantGroups = 'deferredDeleteIrrelevantGroups',

  EnsureBuildings= 'ensureBuildings',
  EnsureRooms = 'ensureRooms',
  EnsureGroups = 'ensureGroups',

  DeleteIrrelevantBuildings = 'deleteIrrelevantBuildings',
  DeleteIrrelevantRooms = 'deleteIrrelevantRooms',
  DeleteIrrelevantGroups = 'deleteIrrelevantGroups'
}

/**
 * The type `T` and error must be fully JSON-serializable and later parsable with the same result
 */
export interface ITaskFailedStep<T> {
  error: any;
  value?: T;
}

/**
 * The type `T` must be fully JSON-serializable and later parsable with the same result
 */
export interface ITaskDefinition<T> {
  taskType: string;
  /**
   * Empty or absent array means either all steps to do or no steps required
   */
  steps?: T[];
  failedSteps?: ITaskFailedStep<T>[];
}

export function isTaskDefinition<T = any>(
  task: unknown,
  // tslint:disable-next-line:variable-name
  TGuard: (step: T) => boolean = () => true,
) {
  return isObjectLike<ITaskDefinition<T>>(task)
    && typeof task.taskType === 'string'
    && (
      !('steps' in task)
      || Array.isArray(task.steps) && task.steps.every(TGuard)
    )
    && (
      !('failedSteps' in task)
      || Array.isArray(task.failedSteps) && task.failedSteps.every(
        s => isObjectLike<ITaskFailedStep<T>>(s)
          && 'error' in s && (!('value' in s) || TGuard(s.value as any))
      )
    );
}

export interface ITaskStepExecutor {
  /**
   * If present, used after every enqueuing as a Array.sort() callback
   */
  taskComparator?(
    first: ITaskDefinition<any>,
    other: ITaskDefinition<any>,
  ): number;

  requiresSteps(taskType: string): boolean;

  /**
   * Should be as much idempotent as possible.
   */
  run<T>(taskType: string): Promise<any>;
  run<T>(taskType: string, step: T): Promise<any>;
  /**
   * Should be as much idempotent as possible.
   */
  rerunFailed<T>(taskType: string, error: any): Promise<any>;
  rerunFailed<T>(taskType: string, step: T, error: any): Promise<any>;
}

export interface ITaskProgressBackend {
  save(tasks: DeepReadonlyArray<ITaskDefinition<any>>): Promise<void>;
  loadAndClear(): Promise<ITaskDefinition<any>[]>;
}

export enum TaskProgressBackend {
  File = 'file',
}

export const taskProgressBackendValues = Object.values(
  TaskProgressBackend
) as ReadonlyArray<TaskProgressBackend>;

export const defaultTaskProgressBackend = TaskProgressBackend.File;
