import { calendar_v3 } from 'googleapis';
import { inject, injectable } from 'inversify';
import iterate from 'iterare';
import {
  as,
  cast,
  DeepReadonly,
  GuardedMap,
  IGuardedMap,
  Mutable, Nullable,
  t,
} from '../../@types';
import { CistEventsResponse, CistGroupsResponse } from '../../@types/cist';
import { ILogger } from '../../@types/logging';
import { ITaskDefinition, TaskType } from '../../@types/tasks';
import { TYPES } from '../../di/types';
import { toGroupIds } from '../../utils/cist';
import { objectEntries } from '../../utils/common';
import { QuotaLimiterService } from '../quota-limiter.service';
import { FatalError } from './errors';
import { EventGoogleContext } from './event-context.service';
import { GoogleApiCalendar } from './google-api-calendar';
import {
  eventHashToEventId,
  GoogleUtilsService,
  hashCistEvent,
  hashGoogleEvent,
  IGoogleEventContext,
  tryGetGoogleEventHash,
} from './google-utils.service';
import Resource$Events = calendar_v3.Resource$Events;
import Schema$Event = calendar_v3.Schema$Event;
import Resource$Colors = calendar_v3.Resource$Colors;
import Params$Resource$Events$Insert = calendar_v3.Params$Resource$Events$Insert;
import Params$Resource$Events$Patch = calendar_v3.Params$Resource$Events$Patch;

const calendarId = 'primary';

export interface ICreateContextConfig {
  ensure: boolean;
  relevant: boolean;
}

export interface IEnsureEventsTaskContext extends IEventsTaskContextBase {
  readonly insertEvents: IGuardedMap<string, Schema$Event>;
  readonly patchEvents: IGuardedMap<string, Schema$Event>;
}

export function isEnsureEventsTaskContext(
  value: DeepReadonly<IEventsTaskContextBase>
): value is IEnsureEventsTaskContext {
  return as<IEnsureEventsTaskContext>(value)
    && value.insertEvents instanceof GuardedMap
    && value.patchEvents instanceof GuardedMap;
}

export interface IRelevantEventsTaskContext extends IEventsTaskContextBase {
  readonly relevantEventIds: Set<string>;
}

export function isRelevantEventsTaskContext(
  value: DeepReadonly<IEventsTaskContextBase>
): value is IRelevantEventsTaskContext {
  return as<IRelevantEventsTaskContext>(value)
    && value.relevantEventIds instanceof Set;
}

export interface IEventsTaskContextBase {
  nextPageToken?: string;
  readonly events: Map<string, Schema$Event>;
}

@injectable()
export class EventsService {
  static readonly ROOMS_PAGE_SIZE = 2500; // max limit
  private readonly _calendar: GoogleApiCalendar;
  private readonly _quotaLimiter: QuotaLimiterService;
  private readonly _utils: GoogleUtilsService;
  private readonly _logger: ILogger;

  private readonly _calendarTimeZone: string;

  private readonly _events: Resource$Events;
  private readonly _colors: Resource$Colors;

  private readonly _insert: Resource$Events['insert'];
  private readonly _patch: Resource$Events['patch'];
  private readonly _delete: Resource$Events['delete'];
  private readonly _list: Resource$Events['list'];
  private readonly _getColors: Resource$Colors['get'];

  private _colorsLoading: Nullable<Promise<any>>;
  private _colorsLoaded: boolean;

  constructor(
    @inject(TYPES.GoogleApiCalendar) googleApiCalendar: GoogleApiCalendar,
    @inject(TYPES.GoogleCalendarQuotaLimiter) quotaLimiter: QuotaLimiterService,
    @inject(TYPES.GoogleUtils) utils: GoogleUtilsService,
    @inject(TYPES.Logger) logger: ILogger,
    @inject(
      TYPES.GoogleCalendarTimeZone
    ) calendarTimeZone: string,
  ) {
    this._utils = utils;
    this._logger = logger;
    this._calendarTimeZone = calendarTimeZone;

    this._calendar = googleApiCalendar;
    this._events = this._calendar.googleCalendar.events;
    this._colors = this._calendar.googleCalendar.colors;
    this._quotaLimiter = quotaLimiter;

    this._insert = this._quotaLimiter.limiter.wrap(
      this._events.insert.bind(this._events),
    ) as any;
    this._patch = this._quotaLimiter.limiter.wrap(
      this._events.patch.bind(this._events),
    ) as any;
    this._delete = this._quotaLimiter.limiter.wrap(
      this._events.delete.bind(this._events),
    ) as any;
    this._list = this._quotaLimiter.limiter.wrap(
      this._events.list.bind(this._events),
    ) as any;
    this._getColors = this._quotaLimiter.limiter.wrap(
      this._colors.get.bind(this._colors)
    ) as any;

    this._colorsLoading = null;
    this._colorsLoaded = false;
  }

  createBaseContextTask(): ITaskDefinition<void> {
    return {
      taskType: TaskType.InitializeEventsBaseContext
    };
  }

  async *loadEventsByChunksToContext(
    context: IEventsTaskContextBase
  ): AsyncGenerator<IEventsTaskContextBase> {
    let eventsPage = null;
    do {
      eventsPage = await this._list({
        calendarId,
        maxResults: EventsService.ROOMS_PAGE_SIZE,
        singleEvents: true,
        timeZone: this._calendarTimeZone,
        pageToken: eventsPage ? eventsPage.data.nextPageToken : undefined, // BUG in typedefs
      });
      context.nextPageToken = eventsPage.data.nextPageToken;
      if (eventsPage.data.items) {
        for (const item of eventsPage.data.items) {
          const hash = tryGetGoogleEventHash(item) ?? hashGoogleEvent(item);
          if (context.events.has(hash)) {
            this._logger.debug(l('has duplicate events, from context, from response'), context.events.get(hash), item);
          }
          context.events.set(hash, item);
        }
        this._logger.info(`Loaded ${context.events.size} Google events...`);
        if (eventsPage.data.items.length > 0) {
          yield context;
        }
      }
    } while (context.nextPageToken);
    this._logger.info(`All ${context.events.size} Google events are loaded!`);
  }

  getCreateContextTypeConfigByTaskType(taskType: TaskType) {
    if (
      taskType !== TaskType.InitializeEnsureEventsContext
      && taskType !== TaskType.InitializeRelevantEventsContext
      && taskType !== TaskType.InitializeEnsureAndRelevantEventsContext
      && taskType !== TaskType.DeferredEnsureEvents
      && taskType !== TaskType.DeferredDeleteIrrelevantEvents
      && taskType !== TaskType.DeferredEnsureAndDeleteIrrelevantEvents
    ) {
      throw new TypeError(l(`Unknown create events context task: ${taskType}`));
    }
    const config: ICreateContextConfig = {
      ensure: false,
      relevant: false
    };
    switch (taskType) {
      case TaskType.DeferredEnsureEvents:
      case TaskType.InitializeEnsureEventsContext:
        config.ensure = true;
        break;

      case TaskType.DeferredDeleteIrrelevantEvents:
      case TaskType.InitializeRelevantEventsContext:
        config.relevant = true;
        break;

      case TaskType.DeferredEnsureAndDeleteIrrelevantEvents:
      case TaskType.InitializeEnsureAndRelevantEventsContext:
        config.ensure = true;
        config.relevant = true;
    }
    return config;
  }

  getTaskTypeForConfig(
    config: DeepReadonly<ICreateContextConfig>
  ): TaskType {
    if (!config.relevant && !config.ensure) {
      throw new TypeError(l('No tasks found'));
    }
    if (config.ensure && !config.relevant) {
      return TaskType.InitializeEnsureEventsContext;
    }
    if (!config.ensure && config.relevant) {
      return TaskType.InitializeRelevantEventsContext;
    }
    return TaskType.InitializeEnsureAndRelevantEventsContext;
  }

  createEventsTaskContext(
    config: DeepReadonly<ICreateContextConfig>
  ): IEventsTaskContextBase {
    if (!config.ensure && !config.relevant) {
      throw new FatalError(l('no tasks requested'));
    }
    const context: IEventsTaskContextBase = {
      events: new Map()
    };
    if (config.ensure) {
      const ensureContext: Mutable<Partial<IEnsureEventsTaskContext>> = context;
      ensureContext.insertEvents = new GuardedMap();
      ensureContext.patchEvents = new GuardedMap();
    }
    if (config.relevant) {
      // tslint:disable-next-line:max-line-length
      const relevantContext: Mutable<Partial<IRelevantEventsTaskContext>> = context;
      relevantContext.relevantEventIds = new Set();
    }
    return context;
  }

  createInitializeContextTask(
    config: DeepReadonly<ICreateContextConfig>,
    cistGroupsResponse: DeepReadonly<CistGroupsResponse>
  ): ITaskDefinition<number> {
    return {
      taskType: this.getTaskTypeForConfig(config),
      steps: Array.from(toGroupIds(cistGroupsResponse))
    };
  }

  getCreateContextTypeConfigByContext(
    context: DeepReadonly<IEventsTaskContextBase>
  ): ICreateContextConfig {
    return {
      ensure: isEnsureEventsTaskContext(context),
      relevant: isRelevantEventsTaskContext(context)
    };
  }

  async updateTasksContext(
    context: IEventsTaskContextBase,
    eventContext: EventGoogleContext,
    cistEventsResponse: CistEventsResponse,
  ) {
    cast<IGoogleEventContext>(eventContext);
    const isEnsureTaskContext = isEnsureEventsTaskContext(context);
    const isRelevantTaskContext = isRelevantEventsTaskContext(context);
    if (!isEnsureTaskContext && !isRelevantTaskContext) {
      throw new TypeError(l('No operations to do!'));
    }
    await this.ensureColorsLoaded();
    eventContext.subjects = new GuardedMap(
      iterate(cistEventsResponse.subjects).map(s => t(s.id, s))
    );
    eventContext.teachers = new GuardedMap(
      iterate(cistEventsResponse.teachers)
        .map(teacher => t(teacher.id, teacher))
    );
    eventContext.types = new GuardedMap(
      iterate(cistEventsResponse.types).map(type => t(type.id, type))
    );
    for (const cistEvent of cistEventsResponse.events) {
      const hash = hashCistEvent(cistEvent);
      let hasLogged = false;
      if (
        isEnsureTaskContext
        && as<IEnsureEventsTaskContext>(context)
        && !context.patchEvents.has(hash)
      ) {
        const googleEvent = context.events.get(hash);
        if (googleEvent) {
          const patch = this._utils.cistEventToGoogleEventPatch(
            googleEvent,
            cistEvent,
            eventContext,
            hash,
          );
          if (patch) {
            context.patchEvents.set(hash, patch);
            this._logger.info(`Added event patch with hash ${hash}`);
            hasLogged = true;
          }
        } else {
          context.insertEvents.set(
            hash,
            this._utils.cistEventToGoogleEvent(cistEvent, eventContext, hash),
          );
          this._logger.info(`Added event insertion with hash ${hash}`);
          hasLogged = true;
        }
      }
      if (isRelevantTaskContext) {
        cast<IRelevantEventsTaskContext>(context);
        context.relevantEventIds.add(hash);
        if (!hasLogged) {
          this._logger.info(`Marked event with hash ${hash} as processed`);
          hasLogged = true;
        }
      }
    }
    return context;
  }

  canCreateInsertEventsTaskForContext(
    context: DeepReadonly<IEnsureEventsTaskContext>
  ) {
    return context.insertEvents.size > 0;
  }

  createInsertEventsTask(
    context: DeepReadonly<IEnsureEventsTaskContext>
  ): ITaskDefinition<string> {
    if (!this.canCreateInsertEventsTaskForContext(context)) {
      throw new FatalError(l('Wrong usage: no entities to insert'));
    }
    return {
      taskType: TaskType.InsertEvents,
      steps: Array.from(context.insertEvents.keys())
    };
  }

  insertEvent(
    eventHash: string,
    context: DeepReadonly<IEnsureEventsTaskContext>,
  ) {
    return Promise.resolve(this._insert({
      calendarId,
      sendUpdates: 'all',
      supportsAttachments: true,
      requestBody: context.insertEvents.get(eventHash)
    } as Params$Resource$Events$Insert)).tap(
      () => this._logger.info(`Inserted event with hash ${eventHash}`)
    );
  }

  canCreatePatchEventsTaskForContext(
    context: DeepReadonly<IEnsureEventsTaskContext>
  ) {
    return context.patchEvents.size > 0;
  }

  createPatchEventsTask(
    context: DeepReadonly<IEnsureEventsTaskContext>
  ): ITaskDefinition<string> {
    if (!this.canCreateInsertEventsTaskForContext(context)) {
      throw new FatalError(l('Wrong usage: no entities to patch'));
    }
    return {
      taskType: TaskType.PatchEvents,
      steps: Array.from(context.patchEvents.keys())
    };
  }

  patchEvent(
    eventHash: string,
    context: DeepReadonly<IEnsureEventsTaskContext>,
  ) {
    return Promise.resolve(this._patch({
      calendarId,
      eventId: eventHashToEventId(eventHash),
      sendUpdates: 'all',
      supportsAttachments: true,
      requestBody: context.patchEvents.get(eventHash)
    } as Params$Resource$Events$Patch)).tap(
      () => this._logger.info(`Patched event with hash ${eventHash}`)
    );
  }

  canCreateDeleteIrrelevantEventsTaskForContext(
    context: DeepReadonly<IRelevantEventsTaskContext>
  ) {
    return this.getIrrelevantEventHashes(context).some(() => true);
  }

  createDeleteIrrelevantEventsTask(
    context: DeepReadonly<IRelevantEventsTaskContext>
  ): ITaskDefinition<string> {
    const ids = Array.from(this.getIrrelevantEventHashes(context));
    if (ids.length === 0) {
      throw new FatalError(l('Wrong usage: no entities to delete'));
    }
    return {
      taskType: TaskType.DeleteIrrelevantEvents,
      steps: ids
    };
  }

  deleteEvent(eventHash: string) {
    return Promise.resolve(this._delete({
      calendarId,
      eventId: eventHashToEventId(eventHash),
      sendUpdates: 'all',
    })).tap(
      () => this._logger.info(`Deleted event with hash ${eventHash}`)
    );
  }

  private async ensureColorsLoaded() {
    if (this._colorsLoaded) {
      return;
    }
    if (this._colorsLoading) {
      return this._colorsLoading;
    }
    this._colorsLoading = this._getColors().then(colors => {
      if (colors.data.event) {
        this._utils.eventColorToId = iterate(objectEntries(colors.data.event))
          .filter(([id, color]) => typeof color.background === 'string'
            && typeof id === 'string')
          .map(([id, color]) => t(color.background as string, id as string))
          .toMap();
        this._colorsLoaded = true;
      }
      this._colorsLoading = null;
    });
  }

  private getIrrelevantEventHashes(
    context: DeepReadonly<IRelevantEventsTaskContext>
  ) {
    return iterate(context.events.keys())
      .filter(h => !context.relevantEventIds.has(h));
  }
}

function l(message: string) {
  return `${EventsService.name}: ${message}`;
}
