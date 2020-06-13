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
function toGroupDataMap(groupsResponse) {
    return iterare_1.default(groupsResponse.university.faculties)
        .map(f => iterare_1.default(f.directions).map(d => ({
        faculty: f,
        direction: d
    })))
        .flatten()
        .map(data => {
        const iterator = iterare_1.default(data.direction.specialities)
            .map(s => iterare_1.default(s.groups).map(g => ({
            faculty: data.faculty,
            direction: data.direction,
            speciality: s,
            group: g
        })))
            .flatten();
        return data.direction.groups
            ? iterare_1.default(data.direction.groups).map(g => ({
                faculty: data.faculty,
                direction: data.direction,
                group: g
            })).concat(iterator)
            : iterator;
    })
        .flatten()
        .map(d => _types_1.t(d.group.id, d))
        .toMap();
}
exports.toGroupDataMap = toGroupDataMap;
//# sourceMappingURL=cist.js.map