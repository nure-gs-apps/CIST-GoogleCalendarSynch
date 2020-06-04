"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const lodash_1 = require("lodash");
exports.nullLogger = {
    debug: lodash_1.noop,
    info: lodash_1.noop,
    warn: lodash_1.noop,
    error: lodash_1.noop,
};
//# sourceMappingURL=logging.js.map