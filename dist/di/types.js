"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// VITALLY IMPORTANT FOR INVERSIFY AS PRECEDING IMPORT
const inversify_1 = require("inversify");
require("reflect-metadata");
exports.TYPES = {
    // constants tokens
    CistBaseApiUrl: Symbol.for('CistBaseApiUrl'),
    CistApiKey: Symbol.for('CistApiKey'),
    GoogleAuthAdminDirectoryKey: Symbol.for('GoogleAuthAdminDirectoryKey'),
    GoogleAdminDirectoryQuotaLimiterConfig: Symbol.for('GoogleAdminDirectoryQuotaLimiterConfig'),
    GoogleCalendarQuotaLimiterConfig: Symbol.for('GoogleAdminDirectoryQuotaLimiterConfig'),
    GoogleAuthSubject: Symbol.for('GoogleAuthSubject'),
    GoogleEntityIdPrefix: Symbol.for('GoogleEntityIdPrefix'),
    GoogleCalendarConfig: Symbol.for('GoogleCalendarConfig'),
    CacheMaxExpiration: Symbol.for('CacheMaxExpiration'),
    CistCacheConfig: Symbol.for('CistCacheConfig'),
    // class tokens
    Config: Symbol.for('Config'),
    Logger: Symbol.for('Logger'),
    Container: Symbol.for('Container'),
    TaskStepExecutor: Symbol.for('TaskStepExecutor'),
    CistJsonHttpClient: Symbol.for('CistJsonHttpClient'),
    CistJsonClient: Symbol.for('CistJsonClient'),
    CistJsonHttpParser: Symbol.for('CistJsonHttpParser'),
    CacheUtils: Symbol.for('CacheUtils'),
    GoogleAuthAdminDirectory: Symbol.for('GoogleAuthAdminDirectory'),
    GoogleUtils: Symbol.for('GoogleUtils'),
    GoogleAdminDirectoryQuotaLimiter: Symbol.for('GoogleAdminDirectoryQuotaLimiter'),
    GoogleCalendarQuotaLimiter: Symbol.for('GoogleCalendarQuotaLimiter'),
    GoogleApiAdminDirectory: Symbol.for('GoogleApiAdminDirectory'),
    GoogleApiCalendar: Symbol.for('GoogleApiCalendar'),
    BuildingsService: Symbol.for('BuildingsService'),
    RoomsService: Symbol.for('RoomsService'),
    GroupsService: Symbol.for('GroupsService'),
    CalendarService: Symbol.for('CalendarService'),
    EventsService: Symbol.for('EventsService'),
};
const injectables = new Set();
function ensureInjectable(type) {
    if (injectables.has(type)) {
        return;
    }
    inversify_1.decorate(inversify_1.injectable(), type);
    injectables.add(type);
}
exports.ensureInjectable = ensureInjectable;
//# sourceMappingURL=types.js.map