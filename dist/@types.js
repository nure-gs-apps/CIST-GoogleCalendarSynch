"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.asReadonly = Symbol('asReadonly');
exports.asPartial = Symbol('asPartial');
function t(...args) {
    return args;
}
exports.t = t;
function isDisposable(obj) {
    const value = obj;
    return typeof value.dispose === 'function'
        && typeof value.isDisposed === 'boolean';
}
exports.isDisposable = isDisposable;
function assertMaxCacheExpiration(config) {
    if (typeof config !== 'object'
        || typeof config.hours !== 'number'
        || typeof config.minutes !== 'number'
        || !Number.isInteger(config.hours)
        || !Number.isInteger(config.minutes)
        || config.hours < 0
        || config.hours >= 24
        || config.minutes < 0
        || config.minutes >= 60) {
        throw new TypeError(`Invalid cache expiration period: ${config.hours}:${config.minutes}`);
    }
}
exports.assertMaxCacheExpiration = assertMaxCacheExpiration;
exports.ASYNC_INIT = Symbol.for('@asyncInit');
//# sourceMappingURL=@types.js.map