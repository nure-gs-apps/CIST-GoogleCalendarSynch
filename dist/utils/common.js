"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function arrayContentEqual(first, second) {
    return first.length === second.length && first.every(e => second.includes(e));
}
exports.arrayContentEqual = arrayContentEqual;
//# sourceMappingURL=common.js.map