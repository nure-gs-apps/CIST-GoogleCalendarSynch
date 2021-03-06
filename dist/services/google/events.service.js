"use strict";
var EventsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const inversify_1 = require("inversify");
const iterare_1 = require("iterare");
const _types_1 = require("../../@types");
const tasks_1 = require("../../@types/tasks");
const types_1 = require("../../di/types");
const cist_1 = require("../../utils/cist");
const common_1 = require("../../utils/common");
const quota_limiter_service_1 = require("../quota-limiter.service");
const errors_1 = require("./errors");
const google_api_calendar_1 = require("./google-api-calendar");
const google_utils_service_1 = require("./google-utils.service");
const calendarId = 'primary';
function isEnsureEventsTaskContext(value) {
    return _types_1.as(value)
        && value.insertEvents instanceof _types_1.GuardedMap
        && value.patchEvents instanceof _types_1.GuardedMap;
}
exports.isEnsureEventsTaskContext = isEnsureEventsTaskContext;
function isRelevantEventsTaskContext(value) {
    return _types_1.as(value)
        && value.relevantEventIds instanceof Set;
}
exports.isRelevantEventsTaskContext = isRelevantEventsTaskContext;
let EventsService = EventsService_1 = class EventsService {
    constructor(googleApiCalendar, quotaLimiter, utils, logger, calendarTimeZone) {
        Object.defineProperty(this, "_calendar", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "_quotaLimiter", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "_utils", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "_logger", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "_calendarTimeZone", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "_events", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "_colors", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "_insert", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "_patch", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "_delete", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "_list", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "_getColors", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "_colorsLoading", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "_colorsLoaded", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this._utils = utils;
        this._logger = logger;
        this._calendarTimeZone = calendarTimeZone;
        this._calendar = googleApiCalendar;
        this._events = this._calendar.googleCalendar.events;
        this._colors = this._calendar.googleCalendar.colors;
        this._quotaLimiter = quotaLimiter;
        this._insert = this._quotaLimiter.limiter.wrap(this._events.insert.bind(this._events));
        this._patch = this._quotaLimiter.limiter.wrap(this._events.patch.bind(this._events));
        this._delete = this._quotaLimiter.limiter.wrap(this._events.delete.bind(this._events));
        this._list = this._quotaLimiter.limiter.wrap(this._events.list.bind(this._events));
        this._getColors = this._quotaLimiter.limiter.wrap(this._colors.get.bind(this._colors));
        this._colorsLoading = null;
        this._colorsLoaded = false;
    }
    createBaseContextTask() {
        return {
            taskType: tasks_1.TaskType.InitializeEventsBaseContext
        };
    }
    async loadEventsPageToContext(context) {
        var _a;
        const eventsPage = await this._list({
            calendarId,
            maxResults: EventsService_1.EVENTS_PAGE_SIZE,
            singleEvents: true,
            timeZone: this._calendarTimeZone,
            pageToken: context.nextPageToken,
        });
        context.nextPageToken = eventsPage.data.nextPageToken;
        if (eventsPage.data.items) {
            for (const item of eventsPage.data.items) {
                const hash = (_a = google_utils_service_1.tryGetGoogleEventHash(item)) !== null && _a !== void 0 ? _a : google_utils_service_1.hashGoogleEvent(item);
                if (context.events.has(hash)) {
                    this._logger.debug(l('has duplicate events, from context, from response'), context.events.get(hash), item);
                }
                context.events.set(hash, item);
            }
            this._logger.info(`Loaded ${context.events.size} Google events...`);
        }
        if (!context.nextPageToken) {
            this._logger.info(`All ${context.events.size} Google events are loaded!`);
            return false;
        }
        return true;
    }
    getCreateContextTypeConfigByTaskType(taskType) {
        if (taskType !== tasks_1.TaskType.InitializeEnsureEventsContext
            && taskType !== tasks_1.TaskType.InitializeRelevantEventsContext
            && taskType !== tasks_1.TaskType.InitializeEnsureAndRelevantEventsContext
            && taskType !== tasks_1.TaskType.DeferredEnsureEvents
            && taskType !== tasks_1.TaskType.DeferredDeleteIrrelevantEvents
            && taskType !== tasks_1.TaskType.DeferredEnsureAndDeleteIrrelevantEvents) {
            throw new TypeError(l(`Unknown create events context task: ${taskType}`));
        }
        const config = {
            ensure: false,
            relevant: false
        };
        switch (taskType) {
            case tasks_1.TaskType.DeferredEnsureEvents:
            case tasks_1.TaskType.InitializeEnsureEventsContext:
                config.ensure = true;
                break;
            case tasks_1.TaskType.DeferredDeleteIrrelevantEvents:
            case tasks_1.TaskType.InitializeRelevantEventsContext:
                config.relevant = true;
                break;
            case tasks_1.TaskType.DeferredEnsureAndDeleteIrrelevantEvents:
            case tasks_1.TaskType.InitializeEnsureAndRelevantEventsContext:
                config.ensure = true;
                config.relevant = true;
        }
        return config;
    }
    getTaskTypeForConfig(config) {
        if (!config.relevant && !config.ensure) {
            throw new TypeError(l('No tasks found'));
        }
        if (config.ensure && !config.relevant) {
            return tasks_1.TaskType.InitializeEnsureEventsContext;
        }
        if (!config.ensure && config.relevant) {
            return tasks_1.TaskType.InitializeRelevantEventsContext;
        }
        return tasks_1.TaskType.InitializeEnsureAndRelevantEventsContext;
    }
    createEventsTaskContext(config) {
        if (!config.ensure && !config.relevant) {
            throw new errors_1.FatalError(l('no tasks requested'));
        }
        const context = {
            events: new Map()
        };
        if (config.ensure) {
            const ensureContext = context;
            ensureContext.insertEvents = new _types_1.GuardedMap();
            ensureContext.patchEvents = new _types_1.GuardedMap();
        }
        if (config.relevant) {
            // tslint:disable-next-line:max-line-length
            const relevantContext = context;
            relevantContext.relevantEventIds = new Set();
        }
        return context;
    }
    createInitializeContextTask(config, cistGroupsResponse) {
        return {
            taskType: this.getTaskTypeForConfig(config),
            steps: Array.from(cist_1.toGroupIds(cistGroupsResponse))
        };
    }
    getCreateContextTypeConfigByContext(context) {
        return {
            ensure: isEnsureEventsTaskContext(context),
            relevant: isRelevantEventsTaskContext(context)
        };
    }
    async updateTasksContext(context, eventContext, cistEventsResponse) {
        _types_1.cast(eventContext);
        const isEnsureTaskContext = isEnsureEventsTaskContext(context);
        const isRelevantTaskContext = isRelevantEventsTaskContext(context);
        if (!isEnsureTaskContext && !isRelevantTaskContext) {
            throw new TypeError(l('No operations to do!'));
        }
        await this.ensureColorsLoaded();
        eventContext.subjects = new _types_1.GuardedMap(iterare_1.default(cistEventsResponse.subjects).map(s => _types_1.t(s.id, s)));
        eventContext.teachers = new _types_1.GuardedMap(iterare_1.default(cistEventsResponse.teachers)
            .map(teacher => _types_1.t(teacher.id, teacher)));
        eventContext.types = new _types_1.GuardedMap(iterare_1.default(cistEventsResponse.types).map(type => _types_1.t(type.id, type)));
        for (const cistEvent of cistEventsResponse.events) {
            const hash = google_utils_service_1.hashCistEvent(cistEvent);
            let hasLogged = false;
            if (isEnsureTaskContext
                && _types_1.as(context)
                && !context.patchEvents.has(hash)) {
                const googleEvent = context.events.get(hash);
                if (googleEvent) {
                    const patch = this._utils.cistEventToGoogleEventPatch(googleEvent, cistEvent, eventContext, hash);
                    if (patch) {
                        context.patchEvents.set(hash, patch);
                        this._logger.info(`Added event patch with hash ${hash}`);
                        hasLogged = true;
                    }
                }
                else {
                    context.insertEvents.set(hash, this._utils.cistEventToGoogleEvent(cistEvent, eventContext, hash));
                    this._logger.info(`Added event insertion with hash ${hash}`);
                    hasLogged = true;
                }
            }
            if (isRelevantTaskContext) {
                _types_1.cast(context);
                context.relevantEventIds.add(hash);
                if (!hasLogged) {
                    this._logger.info(`Marked event with hash ${hash} as processed`);
                    hasLogged = true;
                }
            }
        }
        return context;
    }
    canCreateInsertEventsTaskForContext(context) {
        return context.insertEvents.size > 0;
    }
    createInsertEventsTask(context) {
        if (!this.canCreateInsertEventsTaskForContext(context)) {
            throw new errors_1.FatalError(l('Wrong usage: no entities to insert'));
        }
        return {
            taskType: tasks_1.TaskType.InsertEvents,
            steps: Array.from(context.insertEvents.keys())
        };
    }
    insertEvent(eventHash, context) {
        return Promise.resolve(this._insert({
            calendarId,
            sendUpdates: 'all',
            supportsAttachments: true,
            requestBody: context.insertEvents.get(eventHash)
        })).tap(() => this._logger.info(`Inserted event with hash ${eventHash}`));
    }
    canCreatePatchEventsTaskForContext(context) {
        return context.patchEvents.size > 0;
    }
    createPatchEventsTask(context) {
        if (!this.canCreateInsertEventsTaskForContext(context)) {
            throw new errors_1.FatalError(l('Wrong usage: no entities to patch'));
        }
        return {
            taskType: tasks_1.TaskType.PatchEvents,
            steps: Array.from(context.patchEvents.keys())
        };
    }
    patchEvent(eventHash, context) {
        return Promise.resolve(this._patch({
            calendarId,
            eventId: google_utils_service_1.eventHashToEventId(eventHash),
            sendUpdates: 'all',
            supportsAttachments: true,
            requestBody: context.patchEvents.get(eventHash)
        })).tap(() => this._logger.info(`Patched event with hash ${eventHash}`));
    }
    canCreateDeleteIrrelevantEventsTaskForContext(context) {
        return this.getIrrelevantEventHashes(context).some(() => true);
    }
    createDeleteIrrelevantEventsTask(context) {
        const ids = Array.from(this.getIrrelevantEventHashes(context));
        if (ids.length === 0) {
            throw new errors_1.FatalError(l('Wrong usage: no entities to delete'));
        }
        return {
            taskType: tasks_1.TaskType.DeleteIrrelevantEvents,
            steps: ids
        };
    }
    deleteEvent(eventHash) {
        return Promise.resolve(this._delete({
            calendarId,
            eventId: google_utils_service_1.eventHashToEventId(eventHash),
            sendUpdates: 'all',
        })).tap(() => this._logger.info(`Deleted event with hash ${eventHash}`));
    }
    ensureColorsLoaded() {
        if (this._colorsLoaded) {
            return;
        }
        if (this._colorsLoading) {
            return this._colorsLoading;
        }
        this._colorsLoading = this._getColors().then(colors => {
            if (colors.data.event) {
                this._utils.eventColorToId = iterare_1.default(common_1.objectEntries(colors.data.event))
                    .filter(([id, color]) => typeof color.background === 'string'
                    && typeof id === 'string')
                    .map(([id, color]) => {
                    const background = color.background;
                    return _types_1.t(background[0] === '#' ? background.slice(1) : background, id);
                })
                    .toMap();
                this._colorsLoaded = true;
            }
            this._colorsLoading = null;
        });
        return this._colorsLoading;
    }
    getIrrelevantEventHashes(context) {
        return iterare_1.default(context.events.keys())
            .filter(h => !context.relevantEventIds.has(h));
    }
};
Object.defineProperty(EventsService, "EVENTS_PAGE_SIZE", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: 2500
}); // max limit
EventsService = EventsService_1 = tslib_1.__decorate([
    inversify_1.injectable(),
    tslib_1.__param(0, inversify_1.inject(types_1.TYPES.GoogleApiCalendar)),
    tslib_1.__param(1, inversify_1.inject(types_1.TYPES.GoogleCalendarQuotaLimiter)),
    tslib_1.__param(2, inversify_1.inject(types_1.TYPES.GoogleUtils)),
    tslib_1.__param(3, inversify_1.inject(types_1.TYPES.Logger)),
    tslib_1.__param(4, inversify_1.inject(types_1.TYPES.GoogleCalendarTimeZone)),
    tslib_1.__metadata("design:paramtypes", [google_api_calendar_1.GoogleApiCalendar,
        quota_limiter_service_1.QuotaLimiterService,
        google_utils_service_1.GoogleUtilsService, Object, String])
], EventsService);
exports.EventsService = EventsService;
function l(message) {
    return `${EventsService.name}: ${message}`;
}
//# sourceMappingURL=events.service.js.map