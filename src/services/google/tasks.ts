export enum TaskStepType {
  Patch = 0,
  Insert = 1,
}

export type BuildingTaskStep = [string, TaskStepType]; // first member is id

