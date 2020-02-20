"use strict";
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
const events_1 = require("events");
const _types_1 = require("../../@types");
const common_1 = require("../../utils/common");
var CacheEvent;
(function (CacheEvent) {
    CacheEvent["CacheUpdated"] = "cache-updated";
    CacheEvent["CacheCleared"] = "cache-cleared";
    CacheEvent["SourceChanged"] = "source-changed";
})(CacheEvent = exports.CacheEvent || (exports.CacheEvent = {}));
class CachedValueError extends Error {
    constructor(error, source, sourceEvent, initialEvent) {
        super(error.message);
        Object.defineProperty(this, "error", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: error
        });
        Object.defineProperty(this, "source", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: source
        });
        Object.defineProperty(this, "sourceEvent", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: sourceEvent
        });
        Object.defineProperty(this, "initialEvent", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: initialEvent
        });
        this.error = error;
        this.source = source;
        this.sourceEvent = sourceEvent;
        if (initialEvent) {
            this.initialEvent = initialEvent;
        }
    }
}
exports.CachedValueError = CachedValueError;
class CachedValue extends events_1.EventEmitter {
    constructor(utils) {
        super();
        Object.defineProperty(this, _a, {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "needsSource", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: needsSource
        });
        Object.defineProperty(this, "needsInit", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: needsInit
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
        Object.defineProperty(this, "_isInitialized", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: _isInitialized
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
        Object.defineProperty(this, "errorListener", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: errorListener
        });
        this[_types_1.asReadonly] = this;
        this._utils = utils;
        this._source = null;
        this._value = null;
        this._expiration = this._utils.getMaxExpiration();
        this._isInitialized = false;
        this._clearTimeout = null;
        this.clearListener = () => common_1.throwAsyncIfAny(() => this.clearCache(), error => this.emit('error', new CachedValueError(error, this, CacheEvent.CacheCleared))).catch(error => this.emit('error', error));
        this.updateListener = (value, expiration) => common_1.throwAsyncIfAny(() => this.saveValue(value, expiration).then(() => {
            this._value = value;
            return this.doSetExpiration(expiration, value);
        }).then(() => {
            this.emit(CacheEvent.CacheUpdated, this._value, this._expiration);
        }), error => this.emit('error', new CachedValueError(error, this, CacheEvent.CacheUpdated))).catch(error => this.emit('error', error));
        this.errorListener = error => {
            if (error instanceof CachedValueError) {
                this.emit('error', error.sourceEvent === 'error'
                    ? error
                    : new CachedValueError(error.error, error.source, 'error', error.sourceEvent));
            }
            else {
                this.emit('error', error);
            }
        };
    }
    get source() {
        if (!this.needsSource) {
            throw new TypeError('CachedValue doesn\'t support sources!');
        }
        return this._source;
    }
    get value() {
        return this._value;
    }
    get expiration() {
        return this._expiration;
    }
    get isInitialized() {
        return this.needsInit && this._isInitialized;
    }
    get isDisposed() {
        return !this.isInitialized;
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
        await this.doSetExpiration(date);
    }
    async init(loadFromCache = true) {
        const shouldInit = this.needsInit && !this.isInitialized;
        if (shouldInit) {
            await this.doInit();
            this._isInitialized = true;
        }
        if (loadFromCache) {
            await this.loadFromCache();
        }
        return shouldInit;
    }
    async setSource(source = null) {
        var _b;
        if (!this.needsSource) {
            throw new TypeError('This CachedValue does not require source');
        }
        const changed = source !== this._source;
        if (changed) {
            return false;
        }
        if (this._source) {
            this._source.off(CacheEvent.CacheUpdated, this.updateListener);
            this._source.off(CacheEvent.CacheCleared, this.clearListener);
            this._source.off('error', this.errorListener);
            await this.clearCache();
        }
        const oldSource = this._source;
        this._source = source;
        if (this._source) {
            this._source.on(CacheEvent.CacheUpdated, this.updateListener);
            this._source.on(CacheEvent.CacheCleared, this.clearListener);
            this._source.on('error', this.errorListener);
            const shouldSetExpiration = (this._expiration.valueOf() < this._source.expiration.valueOf());
            if (this._source.value) {
                await this.saveValue(this._source.value, shouldSetExpiration ? this._source.expiration : this._expiration);
                this._value = this._source.value;
                this.emit(CacheEvent.CacheUpdated, this._value, this._expiration);
            }
            if (shouldSetExpiration) {
                await this.doSetExpiration(this._source.expiration, (_b = this._source._value, (_b !== null && _b !== void 0 ? _b : this._value)));
            }
        }
        this.emit(CacheEvent.SourceChanged, this._source, oldSource);
        return true;
    }
    async clearCache() {
        var _b, _c;
        if (this._value === null) {
            return false;
        }
        await this.doClearCache();
        this._value = null;
        this.emit(CacheEvent.CacheCleared);
        this._expiration = (_c = (_b = this._source) === null || _b === void 0 ? void 0 : _b.expiration, (_c !== null && _c !== void 0 ? _c : this._utils.getMaxExpiration()));
        if (this._clearTimeout) {
            clearTimeout(this._clearTimeout);
        }
        return true;
    }
    async loadValue() {
        var _b, _c;
        if (!this.isInitialized) {
            throw new TypeError('CachedValue is not initialized');
        }
        const tuple = await this.doLoadValue();
        tuple[1] = this._utils.clampExpiration(tuple[1], (_c = (_b = this._source) === null || _b === void 0 ? void 0 : _b.expiration, (_c !== null && _c !== void 0 ? _c : this._utils.getMaxExpiration())));
        const [newValue, expiration] = tuple;
        this._value = newValue;
        if (expiration.valueOf() < this._expiration.valueOf()) {
            await this.doSetExpiration(expiration);
            if (this._expiration.valueOf() > Date.now()) {
                this.emit(CacheEvent.CacheUpdated, this._value, this._expiration);
            }
        }
        else {
            this.emit(CacheEvent.CacheUpdated, this._value, this._expiration);
        }
        return this._value;
    }
    async loadFromCache() {
        var _b, _c;
        const tuple = await this.doLoadFromCache();
        tuple[1] = this._utils.clampExpiration(tuple[1], (_c = (_b = this._source) === null || _b === void 0 ? void 0 : _b.expiration, (_c !== null && _c !== void 0 ? _c : this._utils.getMaxExpiration())));
        const [value, expiration] = tuple;
        this._value = value;
        await this.doSetExpiration(expiration);
        return this._value;
    }
    async dispose() {
        if (this.isDisposed) {
            return;
        }
        await this.doDispose();
        this._isInitialized = false;
    }
    doInit() {
        return Promise.resolve();
    }
    doLoadValue() {
        return this.loadValueFromSource();
    }
    doLoadFromCache() {
        return Promise.resolve([this._value, this._expiration]);
    }
    updateExpiration(date) {
        return Promise.resolve();
    }
    loadValueFromSource() {
        const source = this._source;
        if (!source) {
            throw new TypeError('source is not set');
        }
        return source.loadValue().then(v => [v, source.expiration]);
    }
    doDispose() {
        return Promise.resolve();
    }
    saveValue(value, expiration) {
        return Promise.resolve();
    }
    doClearCache() {
        return Promise.resolve();
    }
    async doSetExpiration(newDate, value = this._value) {
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
                this._clearTimeout = setTimeout(() => common_1.throwAsyncIfAny(() => this.clearCache(), error => new CachedValueError(error, this, CacheEvent.CacheCleared)).catch(error => this.emit('error', error)), now - newDate.valueOf());
            }
        }
        await this.updateExpiration(this._expiration);
    }
}
exports.CachedValue = CachedValue;
_a = _types_1.asReadonly;
//# sourceMappingURL=cached-value.js.map