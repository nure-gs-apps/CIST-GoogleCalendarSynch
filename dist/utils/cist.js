"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const iterare_1 = require("iterare");
const google_utils_service_1 = require("../services/google/google-utils.service");
function getFloornamesFromBuilding(building) {
    return Array.from(iterare_1.iterate(building.auditories)
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
//# sourceMappingURL=cist.js.map