"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// VITALLY IMPORTANT FOR INVERSIFY AS PRECEDING IMPORT
const inversify_1 = require("inversify");
require("reflect-metadata");
exports.TYPES = {
    // constants tokens
    CistBaseApi: Symbol.for('CistBaseApi'),
    CistApiKey: Symbol.for('CistApiKey'),
    GoogleAuthKeyFilepath: Symbol.for('GoogleAuthKeyFilepath'),
    GoogleAuthCalendarKeyFilepath: Symbol.for('GoogleAuthCalendarKeyFilepath'),
    GoogleAuthSubject: Symbol.for('GoogleAuthSubject'),
    GoogleAuthScopes: Symbol.for('GoogleAuthScopes'),
    GoogleCalendarConfig: Symbol.for('GoogleCalendarConfig'),
    CacheMaxExpiration: Symbol.for('CacheMaxExpiration'),
    CistCacheConfig: Symbol.for('CistCacheConfig'),
    // class tokens
    Config: Symbol.for('Config'),
    CistJsonHttpClient: Symbol.for('CistJsonHttpClient'),
    CistJsonClient: Symbol.for('CistJsonClient'),
    CistJsonHttpUtils: Symbol.for('CistJsonHttpUtils'),
    CacheUtils: Symbol.for('CacheUtils'),
    GoogleAuth: Symbol.for('GoogleAuth'),
    GoogleUtils: Symbol.for('GoogleUtils'),
    GoogleDirectoryQuotaLimiter: Symbol.for('GoogleDirectoryQuotaLimiter'),
    GoogleCalendarQuotaLimiter: Symbol.for('GoogleCalendarQuotaLimiter'),
    GoogleApiDirectory: Symbol.for('GoogleApiDirectory'),
    GoogleApiCalendar: Symbol.for('GoogleApiCalendar'),
    BuildingsService: Symbol.for('BuildingsService'),
    RoomsService: Symbol.for('RoomsService'),
    GroupsService: Symbol.for('GroupsService'),
    CalendarService: Symbol.for('CalendarService'),
    EventsService: Symbol.for('EventsService'),
};
var ContainerType;
(function (ContainerType) {
    ContainerType[ContainerType["FULL"] = 0] = "FULL";
    ContainerType[ContainerType["CIST_JSON_ONLY"] = 1] = "CIST_JSON_ONLY";
})(ContainerType = exports.ContainerType || (exports.ContainerType = {}));
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