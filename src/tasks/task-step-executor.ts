import { Sema } from 'async-sema/lib';
import { EventEmitter } from 'events';
import { inject, injectable } from 'inversify';
import { DeepReadonly, Nullable, Optional } from '../@types';
import {
  CistGroupsResponse,
  CistRoomsResponse,
  ICistJsonClient,
} from '../@types/cist';
import { ILogger } from '../@types/logging';
import { Disposer, IDisposable, isDisposable } from '../@types/object';
import { ITaskDefinition, ITaskStepExecutor, TaskType } from '../@types/tasks';
import { ensureInjectable, IContainer, TYPES } from '../di/types';
import {
  BuildingsService,
  IBuildingsTaskContext,
} from '../services/google/buildings.service';
import { FatalError } from '../services/google/errors';
import {
  GroupsService,
  IGroupsTaskContext,
} from '../services/google/groups.service';
import {
  IRoomsTaskContext,
  RoomsService,
} from '../services/google/rooms.service';

export enum TaskStepExecutorEventNames {
  NewTask = 'new-task'
}

export interface ITaskStepExecutorWithEvents extends ITaskStepExecutor, EventEmitter {
  on(
    event: TaskStepExecutorEventNames.NewTask,
    listener: (newTask: ITaskDefinition<any>) => any,
  ): this;
}

ensureInjectable(EventEmitter);
@injectable()
export class TaskStepExecutor extends EventEmitter implements ITaskStepExecutor, IDisposable {
  protected readonly _container: IContainer;
  protected readonly _logger: ILogger;
  protected readonly _disposer: Disposer;
  protected _buildingsService: Nullable<BuildingsService>;
  protected _roomsService: Nullable<RoomsService>;
  protected _groupsService: Nullable<GroupsService>;
  protected _cistClient: Nullable<ICistJsonClient>;

  protected _buildingsContext: Nullable<IBuildingsTaskContext>; // FIXME: probably, use cached value with expiration
  protected _buildingsContextSemaphore: Nullable<Sema>;
  protected _roomsContext: Nullable<IRoomsTaskContext>; // FIXME: probably, use cached value with expiration
  protected _roomsContextSemaphore: Nullable<Sema>;
  protected _groupsContext: Nullable<IGroupsTaskContext>; // FIXME: probably, use cached value with expiration
  protected _groupsContextSemaphore: Nullable<Sema>;

  get isDisposed() {
    return this._disposer.isDisposed;
  }

  constructor(
    @inject(TYPES.Container) container: IContainer,
    @inject(TYPES.Logger) logger: ILogger,
  ) {
    super();
    this._container = container;
    this._logger = logger;
    this._disposer = new Disposer(this.doDispose.bind(this));

    this._buildingsService = null;
    this._roomsService = null;
    this._groupsService = null;
    this._cistClient = null;

    this._buildingsContext = null;
    this._roomsContext = null;
    this._groupsContext = null;

    this._buildingsContextSemaphore = null;
    this._roomsContextSemaphore = null;
    this._groupsContextSemaphore = null;
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

  taskComparator(
    first: ITaskDefinition<any>,
    other: ITaskDefinition<any>,
  ) {
    if (
      (
        first.taskType === TaskType.EnsureBuildings
        && other.taskType === TaskType.EnsureRooms
      )
      || (
        first.taskType === TaskType.DeferredEnsureBuildings
        && other.taskType === TaskType.DeferredEnsureRooms
      )
      || (
        first.taskType === TaskType.DeleteIrrelevantRooms
        && other.taskType === TaskType.DeleteIrrelevantBuildings
      )
      || (
        first.taskType === TaskType.DeferredDeleteIrrelevantRooms
        && other.taskType === TaskType.DeferredDeleteIrrelevantBuildings
      )
    ) {
      return -1;
    }
    if (
      (
        first.taskType === TaskType.EnsureRooms
        && other.taskType === TaskType.EnsureBuildings
      )
      || (
        first.taskType === TaskType.DeferredEnsureRooms
        && other.taskType === TaskType.DeferredEnsureBuildings
      )
      || (
        first.taskType === TaskType.DeleteIrrelevantBuildings
        && other.taskType === TaskType.DeleteIrrelevantRooms
      )
      || (
        first.taskType === TaskType.DeferredDeleteIrrelevantBuildings
        && other.taskType === TaskType.DeferredDeleteIrrelevantRooms
      )
    ) {
      return 1;
    }
    return 0;
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
          TaskStepExecutorEventNames.NewTask,
          this.getBuildingsService().createEnsureBuildingsTask(roomsResponse),
        );
      }
        break;

      case TaskType.DeferredDeleteIrrelevantBuildings: {
        assertNoStep(step);
        this.emit(
          TaskStepExecutorEventNames.NewTask,
          this.getBuildingsService().createDeleteIrrelevantTask(
            this._buildingsContext ?? await this.saveAndGetBuildingsContext(
              await this.getCistClient().getRoomsResponse(),
            )
          ),
        );
      }
        break;

      case TaskType.DeferredEnsureRooms: {
        assertNoStep(step);
        const roomsResponse = await this.getCistClient().getRoomsResponse();
        this.emit(
          TaskStepExecutorEventNames.NewTask,
          this.getRoomsService().createEnsureRoomsTask(roomsResponse),
        );
      }
        break;

      case TaskType.DeferredDeleteIrrelevantRooms: {
        assertNoStep(step);
        this.emit(
          TaskStepExecutorEventNames.NewTask,
          this.getRoomsService().createDeleteIrrelevantTask(
            this._roomsContext ?? await this.saveAndGetRoomsContext(
              await this.getCistClient().getRoomsResponse(),
            )
          ),
        );
      }
        break;

      case TaskType.DeferredEnsureGroups: {
        assertNoStep(step);
        const groupsResponse = await this.getCistClient().getGroupsResponse();
        this.emit(
          TaskStepExecutorEventNames.NewTask,
          this.getGroupsService().createEnsureGroupsTask(groupsResponse),
        );
      }
        break;

      case TaskType.DeferredDeleteIrrelevantGroups: {
        assertNoStep(step);
        this.emit(
          TaskStepExecutorEventNames.NewTask,
          this.getGroupsService().createDeleteIrrelevantTask(
            this._groupsContext ?? await this.saveAndGetGroupsContext(
              await this.getCistClient().getGroupsResponse(),
            )
          ),
        );
      }
        break;

      case TaskType.EnsureBuildings: {
        assertCistBuildingId(step);
        await this.getBuildingsService().ensureBuilding(
          step,
          this._buildingsContext ?? await this.saveAndGetBuildingsContext(
            await this.getCistClient().getRoomsResponse(),
          ),
        );
      }
        break;

      case TaskType.DeleteIrrelevantBuildings: {
        assertGoogleBuildingId(step);
        await this.getBuildingsService().deleteBuildingById(step);
      }
        break;

      case TaskType.EnsureRooms: {
        assertCistRoomId(step);
        await this.getRoomsService().ensureRoom(
          step,
          this._roomsContext ?? await this.saveAndGetRoomsContext(
            await this.getCistClient().getRoomsResponse(),
          ),
        );
      }
        break;

      case TaskType.DeleteIrrelevantRooms: {
        assertGoogleRoomId(step);
        await this.getRoomsService().deleteRoomById(step);
      }
        break;

      case TaskType.EnsureGroups: {
        assertCistGroupId(step);
        await this.getGroupsService().ensureGroup(
          step,
          this._groupsContext ?? await this.saveAndGetGroupsContext(
            await this.getCistClient().getGroupsResponse(),
          ),
        );
      }
        break;

      case TaskType.DeleteIrrelevantGroups: {
        assertGoogleGroupIdOrEmail(step);
        await this.getGroupsService().deleteGroupById(step);
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
    roomsResponse: DeepReadonly<CistRoomsResponse>
  ) {
    if (!this._buildingsContextSemaphore) {
      this._buildingsContextSemaphore = new Sema(1);
    }
    try {
      await this._buildingsContextSemaphore.acquire();
      if (!this._buildingsContext) {
        this._buildingsContext = await this.getBuildingsService()
          .createBuildingsContext(roomsResponse);
      }
      return this._buildingsContext;
    } finally {
      this._buildingsContextSemaphore.release();
    }
  }

  private async saveAndGetRoomsContext(
    roomsResponse: DeepReadonly<CistRoomsResponse>
  ) {
    if (!this._roomsContextSemaphore) {
      this._roomsContextSemaphore = new Sema(1);
    }
    try {
      await this._roomsContextSemaphore.acquire();
      if (!this._roomsContext) {
        this._roomsContext = await this.getRoomsService()
          .createRoomsContext(roomsResponse);
      }
      return this._roomsContext;
    } finally {
      this._roomsContextSemaphore.release();
    }
  }

  private async saveAndGetGroupsContext(
    groupsResponse: DeepReadonly<CistGroupsResponse>
  ) {
    if (!this._groupsContextSemaphore) {
      this._groupsContextSemaphore = new Sema(1);
    }
    try {
      await this._groupsContextSemaphore.acquire();
      if (!this._groupsContext) {
        this._groupsContext = await this.getGroupsService()
          .createGroupsTaskContext(groupsResponse);
      }
      return this._groupsContext;
    } finally {
      this._groupsContextSemaphore.release();
    }
  }

  private getBuildingsService() {
    if (!this._buildingsService) {
      this._buildingsService = this._container.get<BuildingsService>(
        TYPES.BuildingsService
      );
    }
    return this._buildingsService;
  }

  private getRoomsService() {
    if (!this._roomsService) {
      this._roomsService = this._container.get<RoomsService>(
        TYPES.RoomsService
      );
    }
    return this._roomsService;
  }

  private getGroupsService() {
    if (!this._groupsService) {
      this._groupsService = this._container.get<GroupsService>(
        TYPES.GroupsService
      );
    }
    return this._groupsService;
  }

  dispose(): Promise<void> {
    return this._disposer.dispose();
  }

  protected doDispose(): Promise<any[]> {
    const promises = [];
    this._buildingsContext = null;
    if (this._cistClient && isDisposable(this._cistClient)) {
      promises.push(this._cistClient.dispose());
    }
    this._cistClient = null;
    this._buildingsService = null;
    return Promise.all(promises);
  }
}

function assertGoogleBuildingId(step: unknown): asserts step is string {
  assertTaskStep(step);
  if (typeof step !== 'string') {
    throw new FatalError(l('Google Building ID must be string'));
  }
}

function assertCistBuildingId(step: unknown): asserts step is string {
  assertTaskStep(step);
  if (typeof step !== 'string') {
    throw new FatalError(l('CIST Building ID must be string'));
  }
}

function assertGoogleRoomId(step: unknown): asserts step is string {
  assertTaskStep(step);
  if (typeof step !== 'string') {
    throw new FatalError(l('Google Room (resource) ID must be string'));
  }
}

function assertCistRoomId(step: unknown): asserts step is string {
  assertTaskStep(step);
  if (typeof step !== 'string') {
    throw new FatalError(l('CIST Room ID must be string'));
  }
}

function assertGoogleGroupIdOrEmail(step: unknown): asserts step is string {
  assertTaskStep(step);
  if (typeof step !== 'string') {
    throw new FatalError(l('Google Group ID must be string'));
  }
}

function assertCistGroupId(step: unknown): asserts step is number {
  assertTaskStep(step);
  if (typeof step !== 'number') {
    throw new FatalError(l('CIST Group ID must be number'));
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
