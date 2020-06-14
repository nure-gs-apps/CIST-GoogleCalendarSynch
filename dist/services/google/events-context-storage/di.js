"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const google_1 = require("../../../@types/google");
const types_1 = require("../../../di/types");
function getEventsTaskContextStorage(context) {
    let type = context.container.get(types_1.TYPES.GoogleCalendarEventsTaskContextStorageType);
    if (!google_1.googleEventsTaskContextStorageValues.includes(type)) {
        type = google_1.defaultGoogleEventsTaskContextStorage;
    }
    switch (type) {
        case google_1.GoogleEventsTaskContextStorage.File:
            return context.container.get(types_1.TYPES.GoogleCalendarEventsFileTaskContextStorage);
    }
}
exports.getEventsTaskContextStorage = getEventsTaskContextStorage;
function getEventsTaskContextStorageSymbol(eventsTaskContextStorage) {
    let type = eventsTaskContextStorage;
    if (!google_1.googleEventsTaskContextStorageValues.includes(type)) {
        type = google_1.defaultGoogleEventsTaskContextStorage;
    }
    switch (type) {
        case google_1.GoogleEventsTaskContextStorage.File:
            return types_1.TYPES.GoogleCalendarEventsFileTaskContextStorage;
    }
}
exports.getEventsTaskContextStorageSymbol = getEventsTaskContextStorageSymbol;
//# sourceMappingURL=di.js.map