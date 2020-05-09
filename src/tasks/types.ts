export enum TaskType {
  EnsureBuildings= 'ensureBuildings',
  EnsureRooms = 'ensureBuildings',
  EnsureGroups = 'ensureGroups'
}

/**
 * The type `T` and error must be fully JSON-serializable and later parsable with the same result
 */
export interface TaskFailedStep<T> {
  error: any;
  value: T;
}

/**
 * The type `T` must be fully JSON-serializable and later parsable with the same result
 */
export interface TaskDefinition<T> {
  taskType: string;
  /**
   * Empty or absent array means either all steps to do or no steps required
   */
  steps?: T[];
  failedSteps?: TaskFailedStep<T>[];
}
