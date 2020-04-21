"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const cached_value_source_1 = require("../caching/cached-value-source");
class CistJsonHttpRoomsCachedValue extends cached_value_source_1.CachedValueSource {
    constructor(cacheUtils, http) {
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
        Object.defineProperty(this, "_http", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: _http
        });
        this._http = http;
    }
    // tslint:disable-next-line:max-line-length
    doLoadFromCache() {
        return this._http.getRoomsResponse()
            .then(response => [response, this.expiration]);
    }
}
exports.CistJsonHttpRoomsCachedValue = CistJsonHttpRoomsCachedValue;
//# sourceMappingURL=cist-json-http-rooms-cached-value.js.map