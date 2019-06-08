"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// VITALLY IMPORTANT FOR INVERSIFY AS PRECEDING IMPORT
require("reflect-metadata");
const inversify_1 = require("inversify");
exports.TYPES = {
    // constants tokens
    CistBaseApi: Symbol.for('CistBaseApi'),
    CistApiKey: Symbol.for('CistApiKey'),
    GoogleAuthDirectoryKeyFilepath: Symbol.for('GoogleAuthDirectoryKeyFilepath'),
    GoogleAuthCalendarKeyFilepath: Symbol.for('GoogleAuthCalendarKeyFilepath'),
    GoogleAuthSubject: Symbol.for('GoogleAuthSubject'),
    // class tokens
    CistJsonClient: Symbol.for('CistJsonClient'),
    GoogleDirectoryAuth: Symbol.for('GoogleDirectoryAuth'),
    GoogleCalendarAuth: Symbol.for('GoogleCalendarAuth'),
    GoogleDirectoryQuotaLimiter: Symbol.for('GoogleDirectoryQuotaLimiter'),
    GoogleApiDirectory: Symbol.for('GoogleApiDirectory'),
    GoogleApiCalendar: Symbol.for('GoogleApiCalendar'),
    BuildingsService: Symbol.for('BuildingsService'),
    RoomsService: Symbol.for('RoomsService'),
    GroupsService: Symbol.for('GroupsService'),
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