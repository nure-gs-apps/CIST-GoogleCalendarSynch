"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// VITALLY IMPORTANT FOR INVERSIFY AS PRECEDING IMPORT
require("reflect-metadata");
const inversify_1 = require("inversify");
exports.TYPES = {
    CistJsonClient: Symbol.for('CistJsonClient'),
    GoogleAuth: Symbol.for('GoogleAuth'),
    GoogleApiAdmin: Symbol.for('GoogleApiAdmin'),
    GoogleApiCalendar: Symbol.for('GoogleApiCalendar'),
    BuildingsService: Symbol.for('BuildingsService'),
    RoomsService: Symbol.for('RoomsService'),
};
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