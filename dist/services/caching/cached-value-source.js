"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const cached_value_1 = require("./cached-value");
class CachedValueSource extends cached_value_1.CachedValue {
    constructor() {
        super(...arguments);
        Object.defineProperty(this, "isDestroyable", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
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
    }
    // tslint:disable-next-line:max-line-length
    doLoadValue() {
        return this.doLoadFromCache();
    }
    doClearCache() {
        return Promise.resolve(false);
    }
    hasCachedValue() {
        return Promise.resolve(true);
    }
    loadExpirationFromCache() {
        return Promise.resolve(this._utils.getMaxExpiration());
    }
}
exports.CachedValueSource = CachedValueSource;
//# sourceMappingURL=cached-value-source.js.map