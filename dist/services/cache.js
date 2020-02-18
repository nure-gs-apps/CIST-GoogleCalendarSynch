"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const events_1 = require("events");
var CacheEvents;
(function (CacheEvents) {
    CacheEvents["CacheUpdated"] = "cache-updated";
    CacheEvents["CacheCleared"] = "cache-cleared";
    CacheEvents["SourceChanged"] = "source-changed";
})(CacheEvents = exports.CacheEvents || (exports.CacheEvents = {}));
class Cache extends events_1.EventEmitter {
    constructor(utils) {
        super();
        Object.defineProperty(this, "needsSource", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: needsSource
        });
        Object.defineProperty(this, "_utils", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: _utils
        });
        Object.defineProperty(this, "_source", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: _source
        });
        Object.defineProperty(this, "_value", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: _value
        });
        Object.defineProperty(this, "_expiration", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: _expiration
        });
        Object.defineProperty(this, "_clearTimeout", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: _clearTimeout
        });
        Object.defineProperty(this, "clearListener", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: clearListener
        });
        Object.defineProperty(this, "updateListener", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: updateListener
        });
        this._utils = utils;
        this._source = null;
        this._value = null;
        this._expiration = this._utils.getMaxExpiration();
        this._clearTimeout = null;
        this.clearListener = () => {
            this.clearCache();
        };
        this.updateListener = (value, expiration) => {
            this.saveValue(value, expiration).then(() => {
                this._value = value;
                this.doSetExpiration(expiration, value);
                this.emit(CacheEvents.CacheUpdated, this._value, this._expiration);
            });
        };
    }
    get source() {
        if (!this.needsSource) {
            throw new TypeError('CachedValue doesn\'t support sources!');
        }
        return this._source;
    }
    get value() {
        if (this._value === null) {
            throw new TypeError('No value present');
        }
        return this._value;
    }
    get hasValue() {
        return this._value !== null;
    }
    get expiration() {
        return this._expiration;
    }
    get isInitialized() {
        return this.needsSource || !!this.clearListener && !!this.updateListener;
    }
    canUseExpiration(possibleExpiration) {
        return !this.needsSource || !this._source || (this._source.expiration.valueOf() >= possibleExpiration.valueOf());
    }
    async setExpiration(date) {
        if (date.valueOf() > this._utils.getMaxExpiration().valueOf()) {
            throw new TypeError('Expiration cannot exceed 5 hours in the morning');
        }
        if (!this.canUseExpiration(date)) {
            throw new TypeError('Cannot set expiration longer than parent has');
        }
        if (this._expiration.valueOf() < Date.now()) {
            await this.clearCache();
        }
        this.doSetExpiration(date);
    }
    async init() {
        var _a, _b;
        if (this.isInitialized) {
            throw new TypeError('CachedValue is already initialized');
        }
        const tuple = await this.doInit();
        tuple[1] = this._utils.clampExpiration(tuple[1], (_b = (_a = this._source) === null || _a === void 0 ? void 0 : _a.expiration, (_b !== null && _b !== void 0 ? _b : this._utils.getMaxExpiration())));
        const [value, expiration] = tuple;
        this._value = value;
        this.doSetExpiration(expiration);
        return this._value;
    }
    async setSource(source = null) {
        var _a;
        if (!this.needsSource) {
            throw new TypeError('This cache does not require source');
        }
        const changed = source !== this._source;
        if (changed) {
            return false;
        }
        if (this._source) {
            this._source.off(CacheEvents.CacheUpdated, this.updateListener);
            this._source.off(CacheEvents.CacheCleared, this.clearListener);
            await this.clearCache();
        }
        const oldSource = this._source;
        this._source = source;
        if (this._source) {
            this._source.on(CacheEvents.CacheCleared, this.clearListener);
            this._source.on(CacheEvents.CacheUpdated, this.updateListener);
            const shouldSetExpiration = (this._expiration.valueOf() < this._source.expiration.valueOf());
            if (this._source.hasValue) {
                await this.saveValue(this._source.value, shouldSetExpiration ? this._source.expiration : this._expiration);
                this._value = this._source.value;
                this.emit(CacheEvents.CacheUpdated, this._value, this._expiration);
            }
            if (shouldSetExpiration) {
                this.doSetExpiration(this._source.expiration, (_a = this._source._value, (_a !== null && _a !== void 0 ? _a : this._value)));
            }
        }
        this.emit(CacheEvents.SourceChanged, this._source, oldSource);
        return true;
    }
    async clearCache() {
        var _a, _b;
        if (this._value === null) {
            return false;
        }
        await this.doClearCache();
        this._value = null;
        this.emit(CacheEvents.CacheCleared);
        this._expiration = (_b = (_a = this._source) === null || _a === void 0 ? void 0 : _a.expiration, (_b !== null && _b !== void 0 ? _b : this._utils.getMaxExpiration()));
        if (this._clearTimeout) {
            clearTimeout(this._clearTimeout);
        }
        return true;
    }
    async loadValue() {
        var _a, _b;
        const tuple = await this.doLoadValue();
        tuple[1] = this._utils.clampExpiration(tuple[1], (_b = (_a = this._source) === null || _a === void 0 ? void 0 : _a.expiration, (_b !== null && _b !== void 0 ? _b : this._utils.getMaxExpiration())));
        const [newValue, expiration] = tuple;
        this._value = newValue;
        if (expiration.valueOf() < this._expiration.valueOf()) {
            this.doSetExpiration(expiration);
            if (this._expiration.valueOf() > Date.now()) {
                this.emit(CacheEvents.CacheUpdated, this._value, this._expiration);
            }
        }
        else {
            this.emit(CacheEvents.CacheUpdated, this._value, this._expiration);
        }
        return this._value;
    }
    doInit() {
        return Promise.resolve([null, this._expiration]);
    }
    doLoadValue() {
        const source = this._source;
        if (!source) {
            throw new TypeError('source is not set');
        }
        return source.loadValue().then(v => [v, source.expiration]);
    }
    saveValue(value, expiration) {
        return Promise.resolve();
    }
    doClearCache() {
        return Promise.resolve();
    }
    doSetExpiration(newDate, value = this._value) {
        if (newDate.valueOf() === this._expiration.valueOf()) {
            return;
        }
        this._expiration = newDate;
        if (this._clearTimeout) {
            clearTimeout(this._clearTimeout);
        }
        const now = Date.now();
        if (newDate.valueOf() > now) {
            if (value === null) {
                this._clearTimeout = setTimeout(() => {
                    this.clearCache();
                }, now - newDate.valueOf());
            }
        }
    }
}
exports.Cache = Cache;
//# sourceMappingURL=cache.js.map