"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class MultiError extends Error {
    constructor(message, errors) {
        super(message);
        Object.defineProperty(this, "errors", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.errors = Array.from(errors);
    }
}
exports.MultiError = MultiError;
class NestedError extends Error {
    constructor(message, error) {
        super(message);
        Object.defineProperty(this, "error", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.error = error;
    }
}
exports.NestedError = NestedError;
//# sourceMappingURL=errors.js.map