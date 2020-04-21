"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const cached_value_source_1 = require("../caching/cached-value-source");
class CistJsonHttpGroupsCachedValue extends cached_value_source_1.CachedValueSource {
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
            value: params
        });
        Object.defineProperty(this, "_http", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: _http
        });
        this._http = http;
        this.params = params;
    }
    // tslint:disable-next-line:max-line-length
    doLoadFromCache() {
        return this._http.getEventsResponse(this.params.typeId, this.params.entityId, this.params.dateLimits).then(response => [response, this.expiration]);
    }
}
exports.CistJsonHttpGroupsCachedValue = CistJsonHttpGroupsCachedValue;
//# sourceMappingURL=cist-json-http-events-cached-value.js.map