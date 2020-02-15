"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// IMPORTANT! INSTALLS MONKEY PATCHES
require("./polyfills");
const config_1 = require("./config");
const types_1 = require("./config/types");
config_1.initializeConfig(types_1.getBasicCliConfiguration()).then(() => {
    // import('./main').catch(failStart);
    console.log(config_1.getConfig());
}).catch(failStart);
function failStart(error) {
    console.error(error);
    process.exit(1);
}
//# sourceMappingURL=index.js.map