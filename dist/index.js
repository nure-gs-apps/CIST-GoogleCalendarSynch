"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// IMPORTANT! INSTALLS MONKEY PATCHES
require("./polyfills");
const config_1 = require("./config");
config_1.initializeConfig(null).then(() => {
    Promise.resolve().then(() => require('./main')).catch(failStart);
}).catch(failStart);
function failStart(error) {
    console.error(error);
    process.exit(1);
}
//# sourceMappingURL=index.js.map