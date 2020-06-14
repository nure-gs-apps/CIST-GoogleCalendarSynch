import { Sema } from 'async-sema/lib';
import { EventEmitter } from 'events';
import { inject, injectable, interfaces } from 'inversify';
import { DeepReadonly, DeepReadonlyArray, Nullable, Optional } from '../@types';
import {
  CistGroupsResponse,
  CistRoomsResponse,
  ICistJsonClient,
  TimetableType,
} from '../@types/cist';
import { IEventsTaskContextStorage } from '../@types/google';
import { ILogger } from '../@types/logging';
import { Disposer, IDisposable, isDisposable } from '../@types/object';
import { ITaskDefinition, ITaskStepExecutor, TaskType } from '../@types/tasks';
import { CistCachePriorities } from '../config/types';
import { ensureInjectable, IContainer, TYPES } from '../di/types';
import {
  BuildingsService,
  IBuildingsTaskContext,
} from '../services/google/buildings.service';
import { FatalError } from '../services/google/errors';
import {
  EventContextService,
  EventGoogleContext,
} from '../services/google/event-context.service';
import {
  EventsService,
  IEventsTaskContextBase,
  isEnsureEventsTaskContext,
  isRelevantEventsTaskContext,
} from '../services/google/events.service';
import {
  GroupsService,
  IGroupsTaskContext,
} from '../services/google/groups.service';
import {
  IRoomsTaskContext,
  RoomsService,
} from '../services/google/rooms.service';
import {
  CistClientEntities,
  getCistCachedClientTypes,
  getCistCachedClientTypesForArgs,
} from '../utils/jobs';
import ServiceIdentifier = interfaces.ServiceIdentifier;

export enum TaskStepExecutorEventNames {
  NewTask = 'new-task'
}

export interface ITaskStepExecutorWithEvents extends ITaskStepExecutor, EventEmitter {
  on(
    event: TaskStepExecutorEventNames.NewTask,
    listener: (newTask: ITaskDefinition<any>) => any,
  ): this;
}

const taskTypesOrder = [
  [
    TaskType.DeferredEnsureBuildings,
    TaskType.DeferredDeleteIrrelevantBuildings,
    TaskType.DeferredEnsureGroups,
    TaskType.DeferredDeleteIrrelevantGroups,
    TaskType.DeferredEnsureRooms,
    TaskType.DeferredDeleteIrrelevantRooms,

    TaskType.EnsureBuildings,
    TaskType.DeleteIrrelevantRooms,
    TaskType.EnsureGroups,
    TaskType.DeleteIrrelevantGroups,
  ],
  [TaskType.EnsureRooms, TaskType.DeleteIrrelevantBuildings],
  [
    TaskType.DeferredEnsureEvents,
    TaskType.DeferredDeleteIrrelevantEvents,
    TaskType.DeferredEnsureAndDeleteIrrelevantEvents,
  ],
  [TaskType.InitializeEventsBaseContext],
  [
    TaskType.InitializeEnsureEventsContext,
    TaskType.InitializeRelevantEventsContext,
    TaskType.InitializeEnsureAndRelevantEventsContext,
  ],
  [
    TaskType.InsertEvents,
    TaskType.PatchEvents,
    TaskType.DeleteIrrelevantEvents,
  ],
  [TaskType.ClearEventsContext]
] as ReadonlyArray<ReadonlyArray<string>>;

ensureInjectable(EventEmitter);
@injectable()
export class TaskStepExecutor extends EventEmitter implements ITaskStepExecutorWithEvents, ITaskStepExecutor, IDisposable {
  protected readonly _container: IContainer;
  protected readonly _logger: ILogger;
  protected readonly _disposer: Disposer;
  protected _buildingsService: Nullable<BuildingsService>;
  protected _roomsService: Nullable<RoomsService>;
  protected _groupsService: Nullable<GroupsService>;
  protected _eventsService: Nullable<EventsService>;
  protected _eventsContextStorage: Nullable<IEventsTaskContextStorage>;
  protected _eventContextStorage: Nullable<EventContextService>;
  protected _cistClient: Nullable<ICistJsonClient>;

  protected _buildingsContext: Nullable<IBuildingsTaskContext>; // FIXME: probably, use cached value with expiration
  protected _buildingsContextSemaphore: Nullable<Sema>;
  protected _roomsContext: Nullable<IRoomsTaskContext>; // FIXME: probably, use cached value with expiration
  protected _roomsContextSemaphore: Nullable<Sema>;
  protected _groupsContext: Nullable<IGroupsTaskContext>; // FIXME: probably, use cached value with expiration
  protected _groupsContextSemaphore: Nullable<Sema>;
  protected _eventsContext: Nullable<IEventsTaskContextBase>; // FIXME: probably, use cached value with expiration
  protected _eventsContextSemaphore: Nullable<Sema>;
  protected _eventContext: Nullable<EventGoogleContext>; // FIXME: probably, use cached value with expiration
  protected _eventContextSemaphore: Nullable<Sema>;

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
    this._eventsService = null;
    this._cistClient = null;
    this._eventsContextStorage = null;
    this._eventContextStorage = null;

    this._buildingsContext = null;
    this._roomsContext = null;
    this._groupsContext = null;
    this._eventsContext = null;
    this._eventContext = null;

    this._buildingsContextSemaphore = null;
    this._roomsContextSemaphore = null;
    this._groupsContextSemaphore = null;
    this._eventsContextSemaphore = null;
    this._eventContextSemaphore = null;
  }

  requiresSteps(taskType: string): boolean {
    switch (taskType) {
      case TaskType.DeferredEnsureBuildings:
      case TaskType.DeferredEnsureRooms:
      case TaskType.DeferredEnsureGroups:
      case TaskType.DeferredDeleteIrrelevantBuildings:
      case TaskType.DeferredDeleteIrrelevantRooms:
      case TaskType.DeferredDeleteIrrelevantGroups:
      case TaskType.DeferredEnsureEvents:
      case TaskType.DeferredDeleteIrrelevantEvents:
      case TaskType.DeferredEnsureAndDeleteIrrelevantEvents:
      case TaskType.InitializeEventsBaseContext:
      case TaskType.InsertEvents:
      case TaskType.PatchEvents:
      case TaskType.DeleteIrrelevantEvents:
      case TaskType.ClearEventsContext:
        return false;

      default:
        return true;
    }
  }

  taskComparator(
    first: ITaskDefinition<any>,
    other: ITaskDefinition<any>,
  ) {
    const firstIndex = taskTypesOrder.findIndex(
      types => types.includes(first.taskType)
    );
    const otherIndex = taskTypesOrder.findIndex(
      types => types.includes(other.taskType)
    );
    return firstIndex - otherIndex;
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

      case TaskType.DeferredEnsureEvents:
      case TaskType.DeferredDeleteIrrelevantEvents:
      case TaskType.DeferredEnsureAndDeleteIrrelevantEvents: {
        if (this._eventsContext) {
          throw new TypeError(l('Usage error: events context is already created'));
        }
        assertNoStep(step);
        this._eventsContext = await this.saveAndGetEventsContext(taskType);
        this.emit(
          TaskStepExecutorEventNames.NewTask,
          this.getEventsService().createBaseContextTask()
        );
        if (taskType !== TaskType.DeferredEnsureEvents) {
          this.emit(TaskStepExecutorEventNames.NewTask, {
            taskType: TaskType.DeleteIrrelevantEvents
          } as ITaskDefinition<any>);
        }
        if (taskType !== TaskType.DeferredDeleteIrrelevantEvents) {
          this.emit(
            TaskStepExecutorEventNames.NewTask,
            { taskType: TaskType.InsertEvents } as ITaskDefinition<void>
          );
          this.emit(
            TaskStepExecutorEventNames.NewTask,
            { taskType: TaskType.PatchEvents } as ITaskDefinition<void>
          );
        }
        this.emit(
          TaskStepExecutorEventNames.NewTask,
          { taskType: TaskType.ClearEventsContext } as ITaskDefinition<void>
        );
      }
        break;

      case TaskType.InitializeEventsBaseContext: {
        assertNoStep(step);
        const context = this._eventsContext ?? await this.loadEventsContext();
        const hasMoreEvents = await this.getEventsService()
          .loadEventsPageToContext(context);
        const events = this.getEventsService();
        if (hasMoreEvents) {
          this.emit(
            TaskStepExecutorEventNames.NewTask,
            events.createBaseContextTask(),
          );
        } else {
          this.emit(
            TaskStepExecutorEventNames.NewTask,
            events.createInitializeContextTask(
              events.getCreateContextTypeConfigByContext(context),
              await this.getCistClient().getGroupsResponse(),
            ),
          );
        }
      }
        break;

      case TaskType.InitializeEnsureEventsContext:
      case TaskType.InitializeRelevantEventsContext:
      case TaskType.InitializeEnsureAndRelevantEventsContext: {
        assertCistGroupId(step);
        await this.getEventsService().updateTasksContext(
          this._eventsContext ?? await this.loadEventsContext(),
          await this.saveAndGetEventContext(),
          await this.getCistClient().getEventsResponse(
            TimetableType.Group,
            step
          ),
        );
      }
        break;

      case TaskType.InsertEvents: {
        const context = this._eventsContext ?? await this.loadEventsContext();
        if (!isEnsureEventsTaskContext(context)) {
          throw new TypeError(l('Unknown state for insert: events context is not for ensuring'));
        }
        const events = this.getEventsService();
        if (!isEventHash(step)) {
          if (events.canCreateInsertEventsTaskForContext(context)) {
            this.emit(
              TaskStepExecutorEventNames.NewTask,
              events.createInsertEventsTask(context)
            );
          }
        } else {
          await events.insertEvent(step, context);
        }
      }
        break;

      case TaskType.PatchEvents: {
        const context = this._eventsContext ?? await this.loadEventsContext();
        if (!isEnsureEventsTaskContext(context)) {
          throw new TypeError(l('Unknown state for patch: events context is not for ensuring'));
        }
        const events = this.getEventsService();
        if (!isEventHash(step)) {
          if (events.canCreatePatchEventsTaskForContext(context)) {
            this.emit(
              TaskStepExecutorEventNames.NewTask,
              events.createPatchEventsTask(context)
            );
          }
        } else {
          await events.patchEvent(step, context);
        }
      }
        break;

      case TaskType.DeleteIrrelevantEvents: {
        const events = this.getEventsService();
        if (!isEventHash(step)) {
          const context = this._eventsContext ?? await this.loadEventsContext();
          if (!isRelevantEventsTaskContext(context)) {
            throw new TypeError(l('Unknown state for patch: events context is not for ensuring'));
          }
          if (events.canCreateDeleteIrrelevantEventsTaskForContext(context)) {
            this.emit(
              TaskStepExecutorEventNames.NewTask,
              events.createDeleteIrrelevantEventsTask(context)
            );
          }
        } else {
          await events.deleteEvent(step);
        }
      }
        break;

      case TaskType.ClearEventsContext: {
        await this.getEventsContextStorage()
          .clear()
          .catch(error => this._logger.warn(
            l('Failed to clear events context'),
            error,
          ));
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

  private async saveAndGetEventsContext(taskType: TaskType) {
    const semaphore = this.getEventsContextSemaphore();
    try {
      await semaphore.acquire();
      if (!this._eventsContext) {
        const events = this.getEventsService();
        this._eventsContext = events.createEventsTaskContext(
          events.getCreateContextTypeConfigByTaskType(taskType)
        );
      }
      return this._eventsContext;
    } finally {
      semaphore.release();
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

  private getEventsService() {
    if (!this._eventsService) {
      this._eventsService = this._container.get<EventsService>(
        TYPES.EventsService
      );
    }
    return this._eventsService;
  }

  private getEventsContextStorage() {
    if (!this._eventsContextStorage) {
      this._eventsContextStorage = this._container
        .get<IEventsTaskContextStorage>(
          TYPES.GoogleCalendarEventsTaskContextStorage
        );
    }
    return this._eventsContextStorage;
  }

  private async saveAndGetEventContext() {
    if (!this._eventContextSemaphore) {
      this._eventContextSemaphore = new Sema(1);
    }
    try {
      await this._eventContextSemaphore.acquire();
      if (!this._eventContext) {
        this._eventContext =
          await this.getEventContextService().createGeneralContext();
      }
      return this._eventContext;
    } finally {
      this._eventContextSemaphore.release();
    }
  }

  private getEventContextService() {
    if (!this._eventContextStorage) {
      this._eventContextStorage = this._container
        .get<EventContextService>(TYPES.GoogleEventContextService);
    }
    return this._eventContextStorage;
  }

  private async loadEventsContext() {
    const semaphore = this.getEventsContextSemaphore();
    try {
      await semaphore.acquire();
      if (!this._eventsContext) {
        this._eventsContext = await this.getEventsContextStorage().load();
      }
      return this._eventsContext;
    } finally {
      semaphore.release();
    }
  }

  private getEventsContextSemaphore() {
    if (!this._eventsContextSemaphore) {
      this._eventsContextSemaphore = new Sema(1);
    }
    return this._eventsContextSemaphore;
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
    if (this._eventsContext) {
      promises.push(this.getEventsContextStorage().save(this._eventsContext));
    }
    this._cistClient = null;
    this._buildingsService = null;
    return Promise.all(promises);
  }
}

export function getRequiredServicesFromTasks(
  tasks: DeepReadonlyArray<ITaskDefinition<any>>,
  cistCachePriorities: DeepReadonly<CistCachePriorities>,
  cistEntitiesToOperateOn?: DeepReadonly<CistClientEntities>,
): ServiceIdentifier<any>[] {
  const types = [TYPES.TaskStepExecutor] as ServiceIdentifier<any>[];
  if (tasks.some(({ taskType }) => (
    taskType === TaskType.DeferredDeleteIrrelevantBuildings
    || taskType === TaskType.DeferredEnsureBuildings
    || taskType === TaskType.EnsureBuildings
    || taskType === TaskType.DeleteIrrelevantBuildings
  ))) {
    types.push(TYPES.BuildingsService);
  }

  if (tasks.some(({ taskType }) => (
    taskType === TaskType.DeferredDeleteIrrelevantRooms
    || taskType === TaskType.DeferredEnsureRooms
    || taskType === TaskType.EnsureRooms
    || taskType === TaskType.DeleteIrrelevantRooms
  ))) {
    types.push(TYPES.RoomsService);
  }

  if (tasks.some(({ taskType }) => (
    taskType === TaskType.DeferredDeleteIrrelevantGroups
    || taskType === TaskType.DeferredEnsureGroups
    || taskType === TaskType.EnsureGroups
    || taskType === TaskType.DeleteIrrelevantGroups
  ))) {
    types.push(TYPES.GroupsService);
  }

  if (tasks.some(({ taskType }) => (
    taskType === TaskType.DeferredEnsureEvents
    || taskType === TaskType.DeferredDeleteIrrelevantEvents
    || taskType === TaskType.DeferredEnsureAndDeleteIrrelevantEvents
    || taskType === TaskType.InitializeEventsBaseContext
    || taskType === TaskType.InitializeEnsureEventsContext
    || taskType === TaskType.InitializeRelevantEventsContext
    || taskType === TaskType.InitializeEnsureAndRelevantEventsContext
    || taskType === TaskType.InsertEvents
    || taskType === TaskType.PatchEvents
    || taskType === TaskType.DeleteIrrelevantEvents
  ))) {
    types.push(TYPES.EventsService);
  }

  if (tasks.some(({ taskType, steps }) => (
    taskType === TaskType.DeferredEnsureEvents
    || taskType === TaskType.DeferredDeleteIrrelevantEvents
    || taskType === TaskType.DeferredEnsureAndDeleteIrrelevantEvents
    || taskType === TaskType.InitializeEventsBaseContext
    || taskType === TaskType.InitializeEnsureEventsContext
    || taskType === TaskType.InitializeRelevantEventsContext
    || taskType === TaskType.InitializeEnsureAndRelevantEventsContext
    || taskType === TaskType.InsertEvents
    || taskType === TaskType.PatchEvents
    || (
      taskType === TaskType.DeleteIrrelevantEvents
      && (!steps || steps.length === 0)
    )
    || taskType === TaskType.ClearEventsContext
  ))) {
    types.push(TYPES.GoogleCalendarEventsTaskContextStorage);
  }

  if (tasks.some(({ taskType }) => (
    taskType === TaskType.InitializeEnsureEventsContext
    || taskType === TaskType.InitializeRelevantEventsContext
    || taskType === TaskType.InitializeEnsureAndRelevantEventsContext
  ))) {
    types.push(TYPES.GoogleEventContextService);
  }

  if (tasks.some(({ taskType }) => (
    taskType === TaskType.DeferredEnsureBuildings
    || taskType === TaskType.DeferredDeleteIrrelevantBuildings
    || taskType === TaskType.EnsureBuildings
    // || taskType === TaskType.DeleteIrrelevantBuildings
    || taskType === TaskType.DeferredEnsureRooms
    || taskType === TaskType.DeferredDeleteIrrelevantRooms
    || taskType === TaskType.EnsureRooms
    // || taskType === TaskType.DeleteIrrelevantRooms
    || taskType === TaskType.DeferredEnsureGroups
    || taskType === TaskType.DeferredDeleteIrrelevantGroups
    || taskType === TaskType.EnsureGroups
    // || taskType === TaskType.DeleteIrrelevantGroups
    || taskType === TaskType.InitializeEventsBaseContext
    || taskType === TaskType.InitializeEnsureEventsContext
    || taskType === TaskType.InitializeRelevantEventsContext
    || taskType === TaskType.InitializeEnsureAndRelevantEventsContext
  ))) {
    types.push(...(
      cistEntitiesToOperateOn
        ? getCistCachedClientTypesForArgs({
          auditories: cistEntitiesToOperateOn.auditories,
          groups: cistEntitiesToOperateOn.groups
            || tasks.some(({ taskType }) => (
              taskType === TaskType.InitializeEventsBaseContext
            )),
          events: cistEntitiesToOperateOn.events
            || tasks.some(({ taskType }) => (
              taskType === TaskType.InitializeEnsureEventsContext
              || taskType === TaskType.InitializeRelevantEventsContext
              || taskType === TaskType.InitializeEnsureAndRelevantEventsContext
            )),
        }, cistCachePriorities)
        : getCistCachedClientTypes(
          cistCachePriorities
        )
    ));
  }
  return types;
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

function isEventHash(step: Optional<any>): step is string {
  return typeof step === 'string';
}

function l(message: string) {
  return `${TaskStepExecutor.name}: ${message}`;
}
