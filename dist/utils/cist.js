"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const iterare_1 = require("iterare");
const _types_1 = require("../@types");
const google_utils_service_1 = require("../services/google/google-utils.service");
function getFloornamesFromBuilding(building) {
    return Array.from(iterare_1.default(building.auditories)
        .map(r => google_utils_service_1.transformFloorName(r.floor))
        .toSet()
        .values());
}
exports.getFloornamesFromBuilding = getFloornamesFromBuilding;
function includesCache(config, type) {
    return config.priorities.auditories.includes(type)
        || config.priorities.events.includes(type)
        || config.priorities.groups.includes(type);
}
exports.includesCache = includesCache;
function toGroupIds(groupsResponse) {
    return toGroupsMap(groupsResponse).keys();
}
exports.toGroupIds = toGroupIds;
function toGroupsMap(groupsResponse) {
    return iterare_1.default(groupsResponse.university.faculties)
        .map(f => f.directions)
        .flatten()
        .map(d => {
        const iterator = iterare_1.default(d.specialities)
            .map(s => s.groups)
            .flatten();
        return d.groups ? iterator.concat(d.groups) : iterator;
    })
        .flatten()
        .map(g => _types_1.t(g.id, g))
        .toMap();
}
exports.toGroupsMap = toGroupsMap;
//# sourceMappingURL=cist.js.map