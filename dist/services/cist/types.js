"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("../../utils/common");
const separator = ':';
function getEventsQueryParamsHash(params) {
    let hash = params.typeId.toString() + separator + params.entityId;
    if (params.dateLimits) {
        hash += separator;
        if (params.dateLimits.from) {
            hash += common_1.dateToSeconds(params.dateLimits.from);
        }
        if (params.dateLimits.to) {
            hash += separator + common_1.dateToSeconds(params.dateLimits.to);
        }
    }
    return hash;
}
exports.getEventsQueryParamsHash = getEventsQueryParamsHash;
var TimetableType;
(function (TimetableType) {
    TimetableType[TimetableType["GROUP"] = 1] = "GROUP";
    TimetableType[TimetableType["TEACHER"] = 2] = "TEACHER";
    TimetableType[TimetableType["ROOM"] = 3] = "ROOM";
})(TimetableType = exports.TimetableType || (exports.TimetableType = {}));
//# sourceMappingURL=types.js.map