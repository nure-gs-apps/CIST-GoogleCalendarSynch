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
const cist_cache_extend_1 = require("./jobs/cist-cache-extend");
const finish_task_1 = require("./jobs/finish-task");
const sync_1 = require("./jobs/sync");
const exit_handler_service_1 = require("./services/exit-handler.service");
const cist_assert_1 = require("./jobs/cist-assert");
const packageInfo = require("../package.json");
exit_handler_service_1.setExitLogger(console);
const usage = `A script for synchronysing NURE CIST schedule to Google Calendar and Google Admin Directory.

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
    .help('help').alias('h', 'help')
    .showHelpOnFail(true)
    .command('cist', 'CIST Commands', (yargs) => {
    const expirationArg = "expiration";
    return yargs
        .help('help').alias('h', 'help')
        .command({
        command: 'assert',
        describe: 'Check responses for validity',
        handler(argv) {
            cist_assert_1.handleCistAssert(argv, config_1.getFullConfig(), console).catch(handleError);
        },
        builder(yargs) {
            return common_1.addEntitiesOptions(yargs)
                .help('help').alias('h', 'help');
        }
    })
        .command({
        command: `extend-cache`,
        describe: 'Extend cache expiration',
        handler(argv) {
            const args = argv;
            cist_cache_extend_1.handleCistCacheExtend(args, args.expiration, config_1.getFullConfig())
                .catch(handleError);
        },
        builder(yargs) {
            return common_1.addEntitiesOptions(yargs)
                .help('help').alias('h', 'help')
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
        .completion()
        .recommendCommands()
        .demandCommand(1);
}, noCommandHandler)
    .command({
    command: 'sync',
    describe: `Synchronize with CIST schedule with G Suite & Google Calendar. Common flags (${"groups"}, ${"auditories"}, ${"events"}) are used for upload to Google, removal of irrelevant is done with additional flags.`,
    handler(argv) {
        sync_1.handleSync(argv, config_1.getFullConfig(), console).catch(handleError);
    },
    builder(yargs) {
        return sync_1.addEntitiesToRemoveOptions(common_1.addEntitiesOptions(yargs, false))
            .help('help').alias('h', 'help')
            .command({
            command: 'finish',
            describe: 'Finish interrupted synchronization task.',
            builder(yargs) {
                return yargs
                    .help('help').alias('h', 'help');
            },
            handler(argv) {
                finish_task_1.handleFinishTask(config_1.getFullConfig(), console).catch(handleError);
            },
        })
            .completion()
            .recommendCommands();
    }
})
    .completion()
    .recommendCommands()
    .demandCommand(1);
yargs.parse();
function noCommandHandler() {
    throw 'Valid command is required';
}
function initializeMiddleware() {
    return config_1.initializeConfig(yargs);
}
function handleError(error) {
    console.error(error);
    exit_handler_service_1.exitGracefully(1);
}
//# sourceMappingURL=cli.js.map