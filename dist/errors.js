"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("./utils/common");
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
function makeJsonSerializable(error, ...propertyNames) {
    const properties = propertyNames.length > 0
        ? propertyNames
        : ['message', 'stack', 'name'];
    for (const property of properties) {
        common_1.makePropertyEnumerable(error, property);
    }
}
exports.makeJsonSerializable = makeJsonSerializable;
//# sourceMappingURL=errors.js.map