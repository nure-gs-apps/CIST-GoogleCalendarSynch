"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
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
    TimetableType[TimetableType["GROUP"] = 1] = "GROUP";
    TimetableType[TimetableType["TEACHER"] = 2] = "TEACHER";
    TimetableType[TimetableType["ROOM"] = 3] = "ROOM";
})(TimetableType = exports.TimetableType || (exports.TimetableType = {}));
//# sourceMappingURL=types.js.map