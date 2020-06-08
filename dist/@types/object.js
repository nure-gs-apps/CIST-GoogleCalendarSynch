"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const lib_1 = require("async-sema/lib");
const inversify_1 = require("inversify");
const common_1 = require("../utils/common");
function isDisposable(obj) {
    const value = obj;
    return typeof value.dispose === 'function'
        && typeof value.isDisposed === 'boolean';
}
exports.isDisposable = isDisposable;
let Disposer = class Disposer {
    constructor(disposer = common_1.asyncNoop) {
        Object.defineProperty(this, "_isDisposed", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "_disposeSemaphore", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.doDispose = disposer;
        this._isDisposed = false;
        this._disposeSemaphore = new lib_1.Sema(1);
    }
    get isDisposed() {
        return this._isDisposed;
    }
    async dispose() {
        try {
            await this._disposeSemaphore.acquire();
            if (this.isDisposed) {
                return Promise.resolve();
            }
            await this.doDispose();
            this._isDisposed = true;
        }
        finally {
            this._disposeSemaphore.release();
        }
    }
    doDispose() { }
};
Disposer = tslib_1.__decorate([
    inversify_1.injectable(),
    tslib_1.__metadata("design:paramtypes", [Function])
], Disposer);
exports.Disposer = Disposer;
exports.ASYNC_INIT = Symbol.for('@asyncInit');
//# sourceMappingURL=object.js.map