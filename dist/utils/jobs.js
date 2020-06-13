"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const types_1 = require("../config/types");
const cached_cist_json_client_service_1 = require("../services/cist/cached-cist-json-client.service");
const cist_json_http_client_service_1 = require("../services/cist/cist-json-http-client.service");
function getCistCachedClientTypesForArgs(operateOn, cachePriorities) {
    const types = [cached_cist_json_client_service_1.CachedCistJsonClientService];
    if ((operateOn.groups
        && cachePriorities.groups.includes(types_1.CacheType.Http))
        || (operateOn.auditories
            && cachePriorities.auditories.includes(types_1.CacheType.Http))
        || (operateOn.events
            && cachePriorities.events.includes(types_1.CacheType.Http))) {
        types.push(cist_json_http_client_service_1.CistJsonHttpClient);
    }
    return types;
}
exports.getCistCachedClientTypesForArgs = getCistCachedClientTypesForArgs;
function getCistCachedClientTypes(cachePriorities) {
    const types = [cached_cist_json_client_service_1.CachedCistJsonClientService];
    if (cachePriorities.groups.includes(types_1.CacheType.Http)
        || cachePriorities.auditories.includes(types_1.CacheType.Http)
        || cachePriorities.events.includes(types_1.CacheType.Http)) {
        types.push(cist_json_http_client_service_1.CistJsonHttpClient);
    }
    return types;
}
exports.getCistCachedClientTypes = getCistCachedClientTypes;
function toDeadlineDate(duration) {
    return new Date(Date.now() + duration.asMilliseconds());
}
exports.toDeadlineDate = toDeadlineDate;
//# sourceMappingURL=jobs.js.map