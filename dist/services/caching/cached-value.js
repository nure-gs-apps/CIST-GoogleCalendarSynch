"use strict";
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
const events_1 = require("events");
const _types_1 = require("../../@types");
const errors_1 = require("../../errors");
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
            value: void 0
        });
        Object.defineProperty(this, "source", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "sourceEvent", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "initialEvent", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
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
            value: void 0
        });
        Object.defineProperty(this, "isDestroyable", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "needsInit", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "_utils", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "_saveValueErrorHandler", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "_doLoadFromCacheErrorHandler", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "_source", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "_expiration", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "_isInitialized", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "_clearTimeout", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "clearListener", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "updateListener", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "errorListener", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this[_types_1.asReadonly] = this;
        this._utils = utils;
        this._source = null;
        this._expiration = this._utils.getMaxExpiration();
        this._isInitialized = false;
        this._clearTimeout = null;
        this.clearListener = () => common_1.throwAsyncIfAny(() => this.clearCache(), error => this.emit('error', new CachedValueError(error, this, CacheEvent.CacheCleared))).catch(error => this.emit('error', error));
        this.updateListener = (value, expiration) => common_1.throwAsyncIfAny(() => this.saveValue(value, expiration)
            .catch(this._saveValueErrorHandler)
            .then(() => {
            return this.doSetExpiration(expiration, value !== null);
        }).then(() => {
            this.emit(CacheEvent.CacheUpdated, value, this._expiration);
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
        this._saveValueErrorHandler = error => {
            throw new errors_1.NestedError(this.t('failed to save value'), error);
        };
        this._doLoadFromCacheErrorHandler = error => {
            throw new errors_1.NestedError(this.t('failed to load from cache'), error);
        };
    }
    get source() {
        if (!this.needsSource) {
            throw new TypeError(this.t('doesn\'t support sources!'));
        }
        return this._source;
    }
    get expiration() {
        return this._expiration;
    }
    get isInitialized() {
        return !this.needsInit || this._isInitialized;
    }
    get isDisposed() {
        return !this.isInitialized;
    }
    get [(_a = _types_1.asReadonly, Symbol.toStringTag)]() {
        return CachedValue.name;
    }
    canUseExpiration(possibleExpiration) {
        return !this.needsSource || !this._source || (this._source.expiration.valueOf() >= possibleExpiration.valueOf());
    }
    async setExpiration(date) {
        var _b;
        this._utils.assertValidExpiration(date);
        if (!this.canUseExpiration(date)) {
            throw new TypeError(this.t(`Cannot set expiration longer than parent ${(_b = this._source) === null || _b === void 0 ? void 0 : _b[Symbol.toStringTag]} has`));
        }
        if (this._expiration.valueOf() < Date.now()) {
            await this.clearCache();
        }
        await this.doSetExpiration(date);
    }
    async init() {
        const shouldInit = this.needsInit && !this.isInitialized;
        if (shouldInit) {
            await this.doInit().catch(error => {
                throw new errors_1.NestedError(this.t('failed to initialize'), error);
            });
            this._expiration = this._utils.clampExpiration(await this.loadExpirationFromCache().catch(error => {
                throw new errors_1.NestedError(this.t('failed load expiration from cache'), error);
            }));
            this._isInitialized = true;
        }
        return shouldInit;
    }
    async setSource(source = null, clearCache = false, loadValue = false) {
        if (!this.needsSource) {
            throw new TypeError(this.t('does not require source'));
        }
        const changed = source !== this._source;
        if (!changed) {
            return false;
        }
        if (this._source) {
            this._source.off(CacheEvent.CacheUpdated, this.updateListener);
            this._source.off(CacheEvent.CacheCleared, this.clearListener);
            this._source.off('error', this.errorListener);
            if (clearCache) {
                await this.clearCache();
            }
        }
        const oldSource = this._source;
        this._source = source;
        if (this._source) {
            this._source.on(CacheEvent.CacheUpdated, this.updateListener);
            this._source.on(CacheEvent.CacheCleared, this.clearListener);
            this._source.on('error', this.errorListener);
            if (loadValue) {
                const value = await this._source.loadValue();
                const shouldSetExpiration = (this._expiration.valueOf() < this._source.expiration.valueOf());
                const newExpiration = shouldSetExpiration
                    ? this._source.expiration
                    : this._expiration;
                if (value !== null) {
                    await this.saveValue(value, newExpiration)
                        .catch(this._saveValueErrorHandler);
                    this.emit(CacheEvent.CacheUpdated, value, newExpiration);
                }
                if (shouldSetExpiration) {
                    await this.doSetExpiration(this._source.expiration, value !== null);
                }
            }
        }
        this.emit(CacheEvent.SourceChanged, this._source, oldSource);
        return true;
    }
    async clearCache() {
        var _b, _c;
        if (!await this.doClearCache().catch(error => {
            throw new errors_1.NestedError(this.t('failed to clear cache'), error);
        })) {
            return false;
        }
        this.emit(CacheEvent.CacheCleared);
        this._expiration = (_c = (_b = this._source) === null || _b === void 0 ? void 0 : _b.expiration) !== null && _c !== void 0 ? _c : this._utils.getMaxExpiration();
        if (this._clearTimeout) {
            clearTimeout(this._clearTimeout);
        }
        return true;
    }
    async loadValue() {
        var _b, _c;
        this.assertInitialized();
        const tuple = await this.doLoadValue().catch(error => {
            throw new errors_1.NestedError(this.t('failed to load value'), error);
        });
        tuple[1] = this._utils.clampExpiration(tuple[1], (_c = (_b = this._source) === null || _b === void 0 ? void 0 : _b.expiration) !== null && _c !== void 0 ? _c : this._utils.getMaxExpiration());
        const [newValue, expiration] = tuple;
        if (expiration.valueOf() < this._expiration.valueOf()) {
            await this.doSetExpiration(expiration, newValue !== null);
            if (this._expiration.valueOf() > Date.now()) {
                this.emit(CacheEvent.CacheUpdated, newValue, this._expiration);
            }
        }
        else {
            this.emit(CacheEvent.CacheUpdated, newValue, this._expiration);
        }
        return newValue;
    }
    async loadFromCache() {
        var _b, _c;
        this.assertInitialized();
        const tuple = await this.doLoadFromCache()
            .catch(this._doLoadFromCacheErrorHandler);
        tuple[1] = this._utils.clampExpiration(tuple[1], (_c = (_b = this._source) === null || _b === void 0 ? void 0 : _b.expiration) !== null && _c !== void 0 ? _c : this._utils.getMaxExpiration());
        const [value, expiration] = tuple;
        await this.doSetExpiration(expiration, value !== null);
        return value;
    }
    async dispose() {
        if (this.isDisposed) {
            return;
        }
        await this.doDispose();
        this._isInitialized = false;
    }
    async destroy() {
        if (!this.isDestroyable) {
            return false;
        }
        this.assertInitialized();
        await this.dispose();
        await this.doDestroy();
        return true;
    }
    // virtual
    doInit() {
        return Promise.resolve();
    }
    // virtual - intercept entire load sequence
    async doLoadValue() {
        const cachedTuple = await this.doLoadFromCache()
            .catch(this._doLoadFromCacheErrorHandler);
        if (cachedTuple[0] !== null && cachedTuple[1].valueOf() >= Date.now()) {
            return cachedTuple;
        }
        return this.loadValueFromSource();
    }
    // virtual
    updateExpiration(date) {
        return Promise.resolve();
    }
    async loadValueFromSource() {
        const source = this._source;
        if (!source) {
            throw new TypeError(this.t('source is not set'));
        }
        const value = await source.loadValue();
        await this.saveValue(value, source.expiration)
            .catch(this._saveValueErrorHandler);
        return [value, source.expiration];
    }
    doDispose() {
        return Promise.resolve();
    }
    doDestroy() {
        return Promise.resolve();
    }
    // virtual
    saveValue(value, expiration) {
        return Promise.resolve();
    }
    async doSetExpiration(newDate, hasValue) {
        if (hasValue !== undefined) {
            // tslint:disable-next-line:no-parameter-reassignment
            hasValue = await this.hasCachedValue().catch(error => {
                throw new errors_1.NestedError(this.t('failed check if has cached value'), error);
            });
        }
        if (newDate.valueOf() === this._expiration.valueOf()) {
            return;
        }
        this._expiration = newDate;
        if (this._clearTimeout) {
            clearTimeout(this._clearTimeout);
        }
        const now = Date.now();
        if (newDate.valueOf() > now) {
            if (!hasValue) {
                this._clearTimeout = setTimeout(() => common_1.throwAsyncIfAny(() => this.clearCache(), error => new CachedValueError(error, this, CacheEvent.CacheCleared)).catch(error => this.emit('error', error)), now - newDate.valueOf());
            }
        }
        await this.updateExpiration(this._expiration).catch(error => {
            throw new errors_1.NestedError(this.t('failed to set new expiration'), error);
        });
    }
    assertInitialized() {
        if (!this.isInitialized) {
            throw new TypeError(this.t('is not initialized'));
        }
    }
    t(message) {
        return `${this[Symbol.toStringTag]}: ${message}`;
    }
}
exports.CachedValue = CachedValue;
//# sourceMappingURL=cached-value.js.map