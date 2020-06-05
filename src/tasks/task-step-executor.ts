import { EventEmitter } from 'events';
import { inject, injectable } from 'inversify';
import { DeepReadonly, Nullable, Optional } from '../@types';
import { ApiRoomsResponse, ICistJsonClient } from '../@types/cist';
import { ILogger } from '../@types/logging';
import { ITaskDefinition, ITaskStepExecutor, TaskType } from '../@types/tasks';
import { ensureInjectable, IContainer, TYPES } from '../di/types';
import {
  BuildingsService,
  IBuildingsTaskContext,
} from '../services/google/buildings.service';
import { FatalError } from '../services/google/errors';

export enum EventNames {
  NewTask = 'new-task'
}

export interface ITaskStepExecutorWithEvents extends ITaskStepExecutor, EventEmitter {
  on(
    event: EventNames.NewTask,
    listener: (newTask: ITaskDefinition<any>) => any,
  ): this;
}

ensureInjectable(EventEmitter);
@injectable()
export class TaskStepExecutor extends EventEmitter implements ITaskStepExecutor {
  protected readonly _container: IContainer;
  protected readonly _logger: ILogger;
  protected _buildingsService: Nullable<BuildingsService>;
  protected _cistClient: Nullable<ICistJsonClient>;

  protected _buildingsContext: Nullable<IBuildingsTaskContext>; // FIXME: probably, use cahced value with expiration

  constructor(
    @inject(TYPES.Container) container: IContainer,
    @inject(TYPES.Logger) logger: ILogger,
  ) {
    super();
    this._container = container;
    this._logger = logger;

    this._buildingsService = null;
    this._cistClient = null;

    this._buildingsContext = null;
  }

  requiresSteps(taskType: string): boolean {
    switch (taskType) {
      case TaskType.DeferredEnsureBuildings:
      case TaskType.DeferredEnsureRooms:
      case TaskType.DeferredEnsureGroups:
      case TaskType.DeferredDeleteIrrelevantBuildings:
      case TaskType.DeferredDeleteIrrelevantRooms:
      case TaskType.DeferredDeleteIrrelevantGroups:
        return false;

      default:
        return true;
    }
  }

  rerunFailed<T>(taskType: string, error: any): Promise<any>;
  rerunFailed<T>(taskType: string, step: T, error: any): Promise<any>;
  rerunFailed<T>(
    taskType: string,
    errorOrStep: any | T,
    errorParam?: any,
  ): Promise<any> {
    let step: Optional<T>;
    let error: any;
    if (errorParam !== undefined) {
      step = errorOrStep as T;
      error = errorParam;
    } else {
      step = undefined;
      error = errorOrStep;
    }
    if (step !== undefined) {
      this._logger.error(l(`rerunning failed task "${taskType}", step ${JSON.stringify(step)}, with error`), error);
    } else {
      this._logger.error(l(`rerunning failed task "${taskType}", with error`), error);
    }
    return this.run(taskType, step);
  }

  run<T>(taskType: string): Promise<any>;
  run<T>(taskType: string, step: T): Promise<any>;
  async run<T>(taskType: string, step?: T): Promise<any> {
    switch (taskType) {
      case TaskType.DeferredEnsureBuildings: {
        assertNoStep(step);
        const roomsResponse = await this.getCistClient().getRoomsResponse();
        this.emit(
          EventNames.NewTask,
          this.getBuildingsService().createEnsureBuildingsTask(roomsResponse),
        );
      }
        break;

      case TaskType.DeferredDeleteIrrelevantBuildings: {
        assertNoStep(step);
        this.emit(
          EventNames.NewTask,
          this.getBuildingsService().createDeleteIrrelevantTask(
            this._buildingsContext
            ?? await this.saveAndGetBuildingsContext(
              await this.getCistClient().getRoomsResponse(),
            )
          ),
        );
      }
        break;

      case TaskType.EnsureBuildings: {
        assertTaskStep(step);
        if (typeof step !== 'string') {
          throw new FatalError(l('Google Building ID must be string'));
        }
        await this.getBuildingsService().ensureBuilding(
          step,
          (
            this._buildingsContext
            ?? await this.saveAndGetBuildingsContext(
              await this.getCistClient().getRoomsResponse(),
            )
          ),
        );
      }
        break;

      case TaskType.DeleteIrrelevantBuildings: {
        assertGoogleBuildingId(step);
        await this.getBuildingsService().deleteBuildingById(step);
      }
        break;
    }
    return Promise.resolve(undefined);
  }

  private getCistClient() {
    if (!this._cistClient) {
      this._cistClient = this._container.get<ICistJsonClient>(
        TYPES.CistJsonClient
      );
    }
    return this._cistClient;
  }

  private async saveAndGetBuildingsContext(
    roomsResponse: DeepReadonly<ApiRoomsResponse>
  ) {
    if (!this._buildingsContext) {
      this._buildingsContext = await this.getBuildingsService()
        .createBuildingsContext(roomsResponse);
    }
    return this._buildingsContext;
  }

  private getBuildingsService() {
    if (!this._buildingsService) {
      this._buildingsService = this._container.get<BuildingsService>(
        TYPES.BuildingsService
      );
    }
    return this._buildingsService;
  }
}

function assertGoogleBuildingId(step: unknown): asserts step is string {
  assertTaskStep(step);
  if (typeof step !== 'string') {
    throw new FatalError(l('Google Building ID must be string'));
  }
}

function assertTaskStep<T>(step: Optional<T>): asserts step is T {
  if (step === undefined) {
    throw new TypeError(l('step is not found'));
  }
}

function assertNoStep(step: Optional<any>): asserts step is undefined {
  if (step !== undefined) {
    throw new TypeError(l('step is not needed'));
  }
}

function l(message: string) {
  return `${TaskStepExecutor.name}: ${message}`;
}
