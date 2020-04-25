"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const cached_value_1 = require("./cached-value");
class MemoryCachedValue extends cached_value_1.CachedValue {
    constructor(utils) {
        super(utils);
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
            value: true
        });
        Object.defineProperty(this, "needsSource", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: true
        });
        Object.defineProperty(this, "_value", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this._value = null;
    }
    get [Symbol.toStringTag]() {
        return MemoryCachedValue.name;
    }
    get value() {
        return this._value;
    }
    async doClearCache() {
        if (this._value === null) {
            return false;
        }
        this._value = null;
        return true;
    }
    doLoadFromCache() {
        return Promise.resolve([this._value, this.expiration]);
    }
    hasCachedValue() {
        return Promise.resolve(this._value !== null);
    }
    loadExpirationFromCache() {
        return Promise.resolve(this._utils.getMaxExpiration());
    }
}
exports.MemoryCachedValue = MemoryCachedValue;
//# sourceMappingURL=memory-cached-value.js.map