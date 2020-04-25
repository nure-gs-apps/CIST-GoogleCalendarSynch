"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// IMPORTANT! INSTALLS MONKEY PATCHES
require("./polyfills");
const iterare_1 = require("iterare");
const os_1 = require("os");
const config_1 = require("./config");
const constants_1 = require("./config/constants");
const types_1 = require("./config/types");
const main_1 = require("./main");
const common_1 = require("./utils/common");
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
    .usage(usage)
    .middleware(initializeMiddleware)
    .command({
    command: `check <${main_1.AssertCommand.entitiesArgName}..>`,
    describe: 'Check responses.',
    builder(yargs) {
        return yargs.positional(main_1.AssertCommand.entitiesArgName, {
            type: 'string',
            demandOption: true,
            describe: `Types of requests to assert [choices: ${common_1.toPrintString(main_1.AssertCommand.getValidAssertTypes())}]`,
        });
    },
    handler(args) {
        const fixArgs = args;
        fixArgs.entities = fixArgs.entities.map(t => Array.isArray(t)
            ? t[0]
            : t);
        main_1.AssertCommand.handle(args, config_1.getFullConfig()).catch(failStart);
    },
})
    .completion()
    .recommendCommands()
    .demandCommand(1, 'Specify a command.')
    .help('help').alias('h', 'help')
    .showHelpOnFail(true);
yargs.parse();
function initializeMiddleware() {
    return config_1.initializeConfig(yargs);
}
function failStart(error) {
    console.error(error);
    process.exit(1);
}
//# sourceMappingURL=index.js.map