"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const cached_value_source_1 = require("../caching/cached-value-source");
class CistJsonHttpEventsCachedValue extends cached_value_source_1.CachedValueSource {
    constructor(cacheUtils, http, params) {
        super(cacheUtils);
        Object.defineProperty(this, "needsInit", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        Object.defineProperty(this, "needsSource", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        Object.defineProperty(this, "params", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "_http", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this._http = http;
        this.params = params;
    }
    // tslint:disable-next-line:max-line-length
    doLoadFromCache() {
        return this._http.getEventsResponse(this.params.typeId, this.params.entityId, this.params.dateLimits).then(response => [response, this._utils.getMaxExpiration()]);
    }
}
exports.CistJsonHttpEventsCachedValue = CistJsonHttpEventsCachedValue;
//# sourceMappingURL=cist-json-http-events-cached-value.js.map