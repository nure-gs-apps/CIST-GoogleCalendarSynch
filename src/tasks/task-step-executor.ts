import { inject, injectable } from 'inversify';
import { ITaskStepExecutor } from '../@types/tasks';
import { IContainer, TYPES } from '../di/types';

@injectable()
export class TaskStepExecutor implements ITaskStepExecutor {
  protected readonly _container: IContainer;

  constructor(@inject(TYPES.Container) container: IContainer) {
    this._container = container;
  }

  requiresSteps(taskType: string): boolean {
    return false;
  }

  rerunFailed<T>(taskType: string, error: any): Promise<any>;
  rerunFailed<T>(taskType: string, step: T, error: any): Promise<any>;
  rerunFailed<T>(
    taskType: string,
    errorOrStep: any | T,
    error?: any,
  ): Promise<any> {
    return Promise.resolve(undefined);
  }

  run<T>(taskType: string): Promise<any>;
  run<T>(taskType: string, step: T): Promise<any>;
  run<T>(taskType: string, step?: T): Promise<any> {
    return Promise.resolve(undefined);
  }
}
