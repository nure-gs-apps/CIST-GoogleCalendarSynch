#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// IMPORTANT! INSTALLS MONKEY PATCHES
require("./polyfills");
const iterare_1 = require("iterare");
const os_1 = require("os");
const common_1 = require("./cli/common");
const config_1 = require("./config");
const constants_1 = require("./config/constants");
const types_1 = require("./config/types");
const exit_handler_service_1 = require("./services/exit-handler.service");
const cist_assert_1 = require("./jobs/cist-assert");
const packageInfo = require("../package.json");
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
    .scriptName(packageInfo.name)
    .middleware(initializeMiddleware)
    .command('cist', 'CIST Commands', (yargs) => {
    const expirationArg = "expiration";
    return yargs
        .command({
        command: 'assert',
        describe: 'Check responses for validity',
        handler(argv) {
            cist_assert_1.handleCistAssert(argv, config_1.getFullConfig())
                .catch(failStart);
        },
        builder(yargs) {
            return common_1.addEntitiesOptions(yargs);
        }
    })
        .command({
        command: `extend-cache`,
        describe: 'Extend cache expiration',
        handler(argv) {
            var _a, _b;
            const args = argv;
            console.log(args);
            console.log('exp', (_a = args.expiration) === null || _a === void 0 ? void 0 : _a.toISOString(), 'rooms', args.auditories, 'grou', args.groups, 'even', (_b = args.events) === null || _b === void 0 ? void 0 : _b.join(', '));
        },
        builder(yargs) {
            return common_1.addEntitiesOptions(yargs)
                .option(expirationArg, {
                type: 'string',
                alias: ['date', 'd', 'exp'],
                demandOption: true,
                describe: 'New expiration to set. Preferably ISO-8601 date-time string or date only.',
                coerce(value) {
                    const date = new Date(value);
                    if (Number.isNaN(date.valueOf())) {
                        throw new TypeError(`Invalid date format: ${value}`);
                    }
                    return date;
                }
            });
        }
    })
        .demandCommand(1);
}, () => { throw 'Valid command is required'; })
    .completion()
    .recommendCommands()
    .demandCommand(1)
    .help('help').alias('h', 'help')
    .showHelpOnFail(true);
yargs.parse();
function initializeMiddleware() {
    return config_1.initializeConfig(yargs);
}
function failStart(error) {
    console.error(error);
    exit_handler_service_1.exitGracefully(1);
}
//# sourceMappingURL=cli.js.map