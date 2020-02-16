"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// VITALLY IMPORTANT FOR INVERSIFY AS PRECEDING IMPORT
require("reflect-metadata");
const inversify_1 = require("inversify");
exports.TYPES = {
    // constants tokens
    CistBaseApi: Symbol.for('CistBaseApi'),
    CistApiKey: Symbol.for('CistApiKey'),
    GoogleAuthKeyFilepath: Symbol.for('GoogleAuthKeyFilepath'),
    GoogleAuthCalendarKeyFilepath: Symbol.for('GoogleAuthCalendarKeyFilepath'),
    GoogleAuthSubject: Symbol.for('GoogleAuthSubject'),
    GoogleAuthScopes: Symbol.for('GoogleAuthScopes'),
    GoogleCalendarConfig: Symbol.for('GoogleCalendarConfig'),
    // class tokens
    Config: Symbol.for('Config'),
    CistJsonClient: Symbol.for('CistJsonClient'),
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
exports.ASYNC_INIT = Symbol.for('@asyncInit');
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