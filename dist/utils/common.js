"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const change_case_1 = require("change-case");
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
//# sourceMappingURL=common.js.map