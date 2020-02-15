"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const yargs = require("yargs");
function getBasicCliConfiguration() {
    return yargs;
    // .option(nameof.full<IFullAppConfig>(c => c.ncgc.configDir), {
    //   alias: '-d',
    //   type: 'string',
    //   default: defaultConfigDirectory,
    // });
}
exports.getBasicCliConfiguration = getBasicCliConfiguration;
//# sourceMappingURL=types.js.map