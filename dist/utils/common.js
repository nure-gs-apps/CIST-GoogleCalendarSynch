"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const change_case_1 = require("change-case");
const iterare_1 = require("iterare");
const lodash_1 = require("lodash");
function arrayContentEqual(first, second) {
    return first.length === second.length && first.every(e => second.includes(e));
}
exports.arrayContentEqual = arrayContentEqual;
function toBase64(value) {
    return Buffer.from(value).toString('base64');
}
exports.toBase64 = toBase64;
function dateToSeconds(date) {
    return Math.round(date.getTime() / 1000);
}
exports.dateToSeconds = dateToSeconds;
exports.camelCaseStripRegex = /[^A-Z0-9$]/gi;
function commonCamelCase(value) {
    return change_case_1.camelCase(value, {
        transform: change_case_1.camelCaseTransformMerge,
        stripRegexp: exports.camelCaseStripRegex
    });
}
exports.commonCamelCase = commonCamelCase;
function* objectValues(object, onlyOwnProperties = true) {
    // tslint:disable-next-line:forin
    for (const prop in object) {
        if (onlyOwnProperties && !object.hasOwnProperty(prop)) {
            continue;
        }
        yield object[prop];
    }
}
exports.objectValues = objectValues;
function* objectKeys(object, onlyOwnProperties = true) {
    // tslint:disable-next-line:forin
    for (const prop in object) {
        if (onlyOwnProperties && !object.hasOwnProperty(prop)) {
            continue;
        }
        yield prop;
    }
}
exports.objectKeys = objectKeys;
function* objectEntries(object, onlyOwnProperties = true) {
    // tslint:disable-next-line:forin
    for (const prop in object) {
        if (onlyOwnProperties && !object.hasOwnProperty(prop)) {
            continue;
        }
        yield [prop, object[prop]];
    }
}
exports.objectEntries = objectEntries;
function normalizeErrorIfAny(fn, mapError, ...args) {
    try {
        return fn(...args).catch(err => {
            throw mapError(err);
        });
    }
    catch (err) {
        throw mapError(err);
    }
}
exports.normalizeErrorIfAny = normalizeErrorIfAny;
function throwAsyncIfAny(fn, mapError, ...args) {
    try {
        return fn(...args).catch(err => {
            throw mapError(err);
        });
    }
    catch (err) {
        return Promise.reject(mapError(err));
    }
}
exports.throwAsyncIfAny = throwAsyncIfAny;
function isObjectLike(value) {
    return lodash_1.isObjectLike(value);
}
exports.isObjectLike = isObjectLike;
function asyncNoop() {
    return Promise.resolve();
}
exports.asyncNoop = asyncNoop;
function isWindows() {
    return process.platform === 'win32';
}
exports.isWindows = isWindows;
var PathUtils;
(function (PathUtils) {
    function getPath(path) {
        return isWindows() ? path.win : path.unix;
    }
    PathUtils.getPath = getPath;
    PathUtils.expandVars = isWindows()
        ? function expandVars(path) {
            return path.replace(/\^?%[\w\d]+\^?%/g, matched => {
                var _a;
                const escapedFirst = matched[0] === '^';
                const escapedLast = matched[matched.length - 2] === '^';
                if (escapedFirst && escapedLast) {
                    return matched.slice(1, -2) + matched[matched.length - 1];
                }
                const variable = matched.slice(escapedFirst ? 2 : 1, escapedLast ? -2 : -1);
                return (_a = process.env[variable]) !== null && _a !== void 0 ? _a : '';
            });
        }
        : function expandVars(path) {
            return path.replace(/\\?\$[\w\d]+/g, matched => {
                var _a;
                if (matched[0] === '\\') {
                    return matched.slice(1);
                }
                const variable = matched.slice(1);
                return (_a = process.env[variable]) !== null && _a !== void 0 ? _a : '';
            });
        };
})(PathUtils = exports.PathUtils || (exports.PathUtils = {}));
function toPrintString(strings) {
    return `"${strings.join('", "')}"`;
}
exports.toPrintString = toPrintString;
function makePropertyEnumerable(object, property) {
    const descriptor = Object.getOwnPropertyDescriptor(object, property);
    if (descriptor && !descriptor.enumerable) {
        descriptor.enumerable = true;
        Object.defineProperty(object, property, descriptor);
    }
}
exports.makePropertyEnumerable = makePropertyEnumerable;
function toGroupIds(groupsResponse) {
    return iterare_1.default(groupsResponse.university.faculties)
        .map(f => f.directions)
        .flatten()
        .filter(d => !!d.groups)
        .map(d => d.groups)
        .flatten()
        .map(g => g.id);
}
exports.toGroupIds = toGroupIds;
function isIterable(value) {
    return isObjectLike(value)
        && typeof value[Symbol.iterator] === 'function';
}
exports.isIterable = isIterable;
//# sourceMappingURL=common.js.map