"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function arrayContentEqual(first, second) {
    return first.length === second.length && first.every(e => second.includes(e));
}
exports.arrayContentEqual = arrayContentEqual;
function toBase64(value) {
    return Buffer.from(value).toString('base64');
}
exports.toBase64 = toBase64;
//# sourceMappingURL=common.js.map