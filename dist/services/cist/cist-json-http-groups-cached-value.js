"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const cached_value_source_1 = require("../caching/cached-value-source");
class CistJsonHttpGroupsCachedValue extends cached_value_source_1.CachedValueSource {
    constructor(cacheUtils, http) {
        super(cacheUtils);
        Object.defineProperty(this, "_http", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this._http = http;
    }
    // tslint:disable-next-line:max-line-length
    doLoadFromCache() {
        return this._http.getGroupsResponse()
            .then(response => [response, this._utils.getMaxExpiration()]);
    }
}
exports.CistJsonHttpGroupsCachedValue = CistJsonHttpGroupsCachedValue;
//# sourceMappingURL=cist-json-http-groups-cached-value.js.map