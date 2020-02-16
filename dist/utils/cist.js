"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const iterare_1 = require("iterare");
const utils_service_1 = require("../services/google/utils.service");
function getFloornamesFromBuilding(building) {
    return Array.from(iterare_1.iterate(building.auditories)
        .map(r => utils_service_1.transformFloorname(r.floor))
        .toSet()
        .values());
}
exports.getFloornamesFromBuilding = getFloornamesFromBuilding;
//# sourceMappingURL=cist.js.map