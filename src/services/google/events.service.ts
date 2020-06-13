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
import { CistEventsResponse } from '../../@types/cist';
import { ILogger } from '../../@types/logging';
import { ICalendarConfig } from '../../@types/services';
import { ITaskDefinition, TaskType } from '../../@types/tasks';
import { TYPES } from '../../di/types';
import { objectEntries } from '../../utils/common';
import { QuotaLimiterService } from '../quota-limiter.service';
import { FatalError } from './errors';
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
  deleteIrrelevant: boolean;
}

export interface IEnsureEventsTaskContext extends IEventsTaskContextBase {
  readonly insertEvents: IGuardedMap<string, Schema$Event>;
  readonly patchEvents: IGuardedMap<string, Schema$Event>;
}

export function isEnsureEventsTaskContext(
  value: IEventsTaskContextBase
): value is IEnsureEventsTaskContext {
  return as<IEnsureEventsTaskContext>(value)
    && value.insertEvents instanceof GuardedMap
    && value.patchEvents instanceof GuardedMap;
}

export interface IRelevantEventsTaskContext extends IEventsTaskContextBase {
  readonly relevantEventIds: Set<string>;
}

export function isRelevantEventsTaskContext(
  value: IEventsTaskContextBase
): value is IRelevantEventsTaskContext {
  return as<IRelevantEventsTaskContext>(value)
    && value.relevantEventIds instanceof Set;
}

export interface IEventsTaskContextBase {
  continuationToken?: string;
  readonly events: Map<string, Schema$Event>;
}

@injectable()
export class EventsService {
  static readonly ROOMS_PAGE_SIZE = 2500; // max limit
  private readonly _calendar: GoogleApiCalendar;
  private readonly _quotaLimiter: QuotaLimiterService;
  private readonly _utils: GoogleUtilsService;
  private readonly _logger: ILogger;

  private readonly _calendarConfig: DeepReadonly<ICalendarConfig>;

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
      TYPES.GoogleCalendarConfig
    ) calendarConfig: DeepReadonly<ICalendarConfig>,
  ) {
    this._utils = utils;
    this._logger = logger;
    this._calendarConfig = calendarConfig;

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
      taskType: TaskType.CreateEventsBaseContext
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
        timeZone: this._calendarConfig.timeZone,
        pageToken: eventsPage ? eventsPage.data.nextPageToken : undefined, // BUG in typedefs
      });
      context.continuationToken = eventsPage.data.nextPageToken;
      if (eventsPage.data.items) {
        for (const item of eventsPage.data.items) {
          const hash = tryGetGoogleEventHash(item) ?? hashGoogleEvent(item);
          if (context.events.has(hash)) {
            this._logger.debug(l('has duplicate events, from context, from response'), context.events.get(hash), item);
          }
          context.events.set(hash, item);
        }
        this._logger.info(`Loaded ${context.events.size} events...`);
      }
      yield context;
    } while (context.continuationToken);
    this._logger.info('All events are loaded!');
  }

  getCreateEventsTaskContext(taskType: TaskType) {
    if (
      taskType !== TaskType.CreateEnsureEventsContext
      && taskType !== TaskType.CreateDeleteIrrelevantEventsContext
      && taskType !== TaskType.CreateEnsureAndDeleteIrrelevantEventsContext
    ) {
      throw new TypeError(l(`Unknown create events context task: ${taskType}`));
    }
    const config: ICreateContextConfig = {
      ensure: false,
      deleteIrrelevant: false
    };
    switch (taskType) {
      case TaskType.CreateEnsureEventsContext:
        config.ensure = true;
        break;

      case TaskType.CreateDeleteIrrelevantEventsContext:
        config.deleteIrrelevant = true;
        break;

      case TaskType.CreateEnsureAndDeleteIrrelevantEventsContext:
        config.ensure = true;
        config.deleteIrrelevant = true;
    }
    return config;
  }

  createContextTask(
    config: DeepReadonly<ICreateContextConfig>
  ): ITaskDefinition<void> {
    return {
      taskType: this.getTaskTypeForConfig(config)
    };
  }

  getTaskTypeForConfig(
    config: DeepReadonly<ICreateContextConfig>
  ): TaskType {
    if (!config.deleteIrrelevant && !config.ensure) {
      throw new TypeError(l('No tasks found'));
    }
    if (config.ensure && !config.deleteIrrelevant) {
      return TaskType.CreateEnsureEventsContext;
    }
    if (!config.ensure && config.deleteIrrelevant) {
      return TaskType.CreateDeleteIrrelevantEventsContext;
    }
    return TaskType.CreateEnsureAndDeleteIrrelevantEventsContext;
  }

  createEventsTaskContext(
    config: DeepReadonly<ICreateContextConfig>
  ): IEventsTaskContextBase {
    if (!config.ensure && !config.deleteIrrelevant) {
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
    if (config.deleteIrrelevant) {
      // tslint:disable-next-line:max-line-length
      const deleteContext: Mutable<Partial<IRelevantEventsTaskContext>> = context;
      deleteContext.relevantEventIds = new Set();
    }
    return context;
  }

  async updateTasksContext(
    context: IEventsTaskContextBase,
    eventContext: IGoogleEventContext,
    cistEventsResponse: CistEventsResponse,
  ) {
    const isEnsureTaskContext = !isEnsureEventsTaskContext(context);
    const isRelevantTaskContext = !isRelevantEventsTaskContext(context);
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
          }
        } else {
          context.insertEvents.set(
            hash,
            this._utils.cistEventToGoogleEvent(cistEvent, eventContext, hash),
          );
          this._logger.info(`Added event insertion with hash ${hash}`);
        }
      }
      if (isRelevantTaskContext) {
        cast<IRelevantEventsTaskContext>(context);
        context.relevantEventIds.add(hash);
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
      taskType: TaskType.PatchEvents,
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
