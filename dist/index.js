"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// IMPORTANT! INSTALLS MONKEY PATCHES
require("./polyfills");
const iterare_1 = require("iterare");
const os_1 = require("os");
const config_1 = require("./config");
const constants_1 = require("./config/constants");
const types_1 = require("./config/types");
const container_1 = require("./di/container");
const usage = `A script for synchronysing NURE CIST schedule to Google Calendar and Google Directory.

The script accepts command line options that override configuration of the script.
The options described in help to this script may not include all the properties. All possible values can be seen by default in "${constants_1.getDefaultConfigDirectory()}".
All configuration values must be prefixed by --ncgc. and can have '.' that represents object nested values.
E.g. --ncgc.some.nested-value corresponds to ncgc.some.nestedValue
There is a sound hierarchy of configuration overrides:

Firstly, configurations go from files in such order (the lowest has the highest priority, overrides all the previous):
  - default.{EXT}
  - {NODE_ENV_VALUE}.{EXT}
  - local.{EXT}
  - local-{NODE_ENV_VALUE}.{EXT}
where {NODE_ENV_VALUE} corresponds to lower-cased value of NODE_ENV environmental variable,
      {EXT} is extension of TOML, YAML or JSON files; if there multiple files with the same basename, but different extension, they will be loaded in such order:
      (the lowest has the highest priority, overrides all the previous)
${iterare_1.default(config_1.getSupportedConfigExtensionsInPriorityOrder()).reduce((str, ext) => `      - ${ext}${os_1.EOL}${str}`, '')}
      e.g. default.json will be overriden by default.yaml

Secondly, all configuration values can be overriden by environment variables.
All such configuration values are prefixed by NCGC__ regardless of case.
All environment configuration values are case-insensitive, snake-cased and have '__' to represent object nested values.
E.g. NCGC__SOME__NESTED_VALUE corresponds to ncgc.some.nestedValue
You can also use .env file configuration in this case.

Lastly, command line arguments are used. They are described at the beginning of this message and override all previously set values.
`;
const yargs = types_1.getBasicCliConfiguration()
    .middleware(initializeMiddleware)
    .command({
    command: 'check <types..>',
    // aliases: ['gen', 'g'],
    describe: 'Check responses.',
    builder(yargs) {
        return yargs.positional('types', {
            type: 'string',
            choices: ['groups', 'rooms']
        });
    },
    handler(args) {
        if (!mod || !container) {
            throw new TypeError('No container or module');
        }
        mod.assertResponse(args, container).catch(failStart);
    },
})
    .usage(usage)
    .completion()
    .recommendCommands()
    .demandCommand(1, 'Specify a command.')
    .help('help').alias('h', 'help')
    .showHelpOnFail(true);
let mod = null;
let container = null;
function initializeMiddleware() {
    return config_1.initializeConfig(yargs).then(() => {
        const c = container_1.createContainer();
        return container_1.getAsyncInitializer()
            .then(() => {
            container = c;
        })
            .then(() => Promise.resolve().then(() => require('./handlers')))
            .then(m => mod = m);
    });
}
function failStart(error) {
    console.error(error);
    process.exit(1);
}
//# sourceMappingURL=index.js.map