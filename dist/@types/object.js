"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function isDisposable(obj) {
    const value = obj;
    return typeof value.dispose === 'function'
        && typeof value.isDisposed === 'boolean';
}
exports.isDisposable = isDisposable;
exports.ASYNC_INIT = Symbol.for('@asyncInit');
//# sourceMappingURL=object.js.map