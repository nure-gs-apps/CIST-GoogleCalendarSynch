"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var EntityType;
(function (EntityType) {
    EntityType["Events"] = "events";
    EntityType["Groups"] = "groups";
    EntityType["Rooms"] = "rooms";
})(EntityType = exports.EntityType || (exports.EntityType = {}));
class ThrowCistJsonClient {
    constructor() {
    }
    static getInstance() {
        if (!this._getInstance) {
            this._getInstance = new ThrowCistJsonClient();
        }
        return this._getInstance;
    }
    getEventsResponse(type, entityId, dateLimits) {
        throw new TypeError('Cist Json Client is not found');
    }
    getGroupsResponse() {
        throw new TypeError('Cist Json Client is not found');
    }
    getRoomsResponse() {
        throw new TypeError('Cist Json Client is not found');
    }
}
exports.ThrowCistJsonClient = ThrowCistJsonClient;
Object.defineProperty(ThrowCistJsonClient, "_getInstance", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: null
});
var TimetableType;
(function (TimetableType) {
    TimetableType[TimetableType["Group"] = 1] = "Group";
    TimetableType[TimetableType["Teacher"] = 2] = "Teacher";
    TimetableType[TimetableType["Room"] = 3] = "Room";
})(TimetableType = exports.TimetableType || (exports.TimetableType = {}));
//# sourceMappingURL=types.js.map