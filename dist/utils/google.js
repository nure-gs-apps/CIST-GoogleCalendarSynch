"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const _types_1 = require("../@types");
const events_service_1 = require("../services/google/events.service");
function eventsTaskContextToSerializable(context) {
    const serializable = {
        events: Array.from(context.events.entries())
    };
    if (typeof context.nextPageToken === 'string') {
        serializable.nextPageToken = context.nextPageToken;
    }
    if (events_service_1.isEnsureEventsTaskContext(context)) {
        serializable.insertEvents = Array.from(context.insertEvents.entries());
        serializable.patchEvents = Array.from(context.patchEvents.entries());
    }
    if (events_service_1.isRelevantEventsTaskContext(context)) {
        serializable.relevantEventIds = Array.from(context.relevantEventIds);
    }
    return context;
}
exports.eventsTaskContextToSerializable = eventsTaskContextToSerializable;
function eventsTaskContextFromSerializable(serializable) {
    var _a, _b;
    const context = {
        events: new Map(serializable.events)
    };
    if (typeof serializable.nextPageToken === 'string') {
        context.nextPageToken = serializable.nextPageToken;
    }
    if (serializable.relevantEventIds) {
        _types_1.cast(context);
        context.relevantEventIds = new Set(serializable.relevantEventIds);
    }
    if (serializable.insertEvents || serializable.patchEvents) {
        _types_1.cast(context);
        context.insertEvents = new _types_1.GuardedMap((_a = serializable.insertEvents) !== null && _a !== void 0 ? _a : []);
        context.patchEvents = new _types_1.GuardedMap((_b = serializable.patchEvents) !== null && _b !== void 0 ? _b : []);
    }
    return context;
}
exports.eventsTaskContextFromSerializable = eventsTaskContextFromSerializable;
//# sourceMappingURL=google.js.map