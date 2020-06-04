"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const filter_1 = require("iterare/lib/filter");
const map_1 = require("iterare/lib/map");
const common_1 = require("../utils/common");
exports.asReadonly = Symbol('asReadonly');
exports.asPartial = Symbol('asPartial');
function t(...args) {
    return args;
}
exports.t = t;
class GuardedMap extends Map {
    constructor(
    // tslint:disable-next-line:max-line-length
    entries, filterUndefined = false) {
        super(entries !== undefined && entries !== null ? (common_1.isIterable(entries) ? (toGuardedMapIterator(entries[Symbol.iterator](), filterUndefined)) : toGuardedMapIterator(entries, filterUndefined)) : null);
    }
    get(key) {
        const value = super.get(key);
        if (value === undefined) {
            throw new TypeError(`key ${key} is not found in the map`);
        }
        return value;
    }
    set(key, value) {
        if (value === undefined) {
            throwMapSetError(key, value);
        }
        return super.set(key, value);
    }
    forEach(callbackfn, thisArg) {
        return super.forEach(callbackfn, thisArg);
    }
}
exports.GuardedMap = GuardedMap;
function toGuardedMapIterator(entries, filterUndefined = false) {
    return filterUndefined
        ? new filter_1.FilterIterator(entries, pair => pair[1] !== undefined)
        : new map_1.MapIterator(entries, pair => {
            if (pair[1] === undefined) {
                throwMapSetError(pair[0], pair[1]);
            }
            return pair;
        });
}
function throwMapSetError(key, value) {
    throw new TypeError(`value ${value} for key ${key} is undefined`);
}
//# sourceMappingURL=index.js.map