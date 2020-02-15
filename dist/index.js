"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// IMPORTANT! INSTALLS MONKEY PATCHES
require("./polyfills");
const config_1 = require("./config");
const types_1 = require("./config/types");
const yargs = types_1.getBasicCliConfiguration()
    .help();
config_1.initializeConfig(yargs).then(() => {
    // import('./main').catch(failStart);
    console.log(config_1.getConfig());
}).catch(failStart);
function failStart(error) {
    console.error(error);
    process.exit(1);
}
//# sourceMappingURL=index.js.map