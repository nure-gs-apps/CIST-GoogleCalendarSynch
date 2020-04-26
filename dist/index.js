"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// IMPORTANT! INSTALLS MONKEY PATCHES
require("./polyfills");
const iterare_1 = require("iterare");
const os_1 = require("os");
// import { Arguments } from 'yargs';
// import { DeepPartial } from './@types';
const config_1 = require("./config");
const constants_1 = require("./config/constants");
const types_1 = require("./config/types");
const main_1 = require("./main");
const common_1 = require("./utils/common");
// import { toPrintString } from './utils/common';
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
    .command('cache', 'CIST Cache utilities', (yargs) => {
    const groupsName = "groups";
    const auditoriesName = "auditories";
    const eventsName = "events";
    return yargs
        .option(groupsName, {
        alias: groupsName[0],
        description: 'Operate on groups',
        type: 'boolean'
    })
        .option(auditoriesName, {
        alias: auditoriesName[0],
        description: 'Operate on auditories',
        type: 'boolean'
    })
        .option(eventsName, {
        alias: eventsName[0],
        description: 'Operate on events. Supply "all", "" or nothing for all events. Supply list of coma-separated (no spaces) Group IDs to fetch events for',
        type: 'string',
        coerce(value) {
            const str = value;
            if (str === '' || str === 'all') {
                return [];
            }
            if (!value) {
                return null;
            }
            const initialArgs = str.split(/\s*,\s*/);
            const ids = iterare_1.default(initialArgs)
                .map(v => Number.parseInt(v, 10))
                .filter(v => !Number.isNaN(v))
                .toArray();
            if (ids.length === 0) {
                throw new TypeError('No Group IDs parsed');
            }
            if (initialArgs.length !== ids.length) {
                console.warn(`Only such IDs found: ${common_1.toPrintString(ids)}`);
            }
            return ids;
        },
        requiresArg: false,
    })
        .check(args => main_1.assertHasEntities(args))
        .command({
        command: 'assert',
        describe: 'Check responses for validity',
        handler(argv) {
            main_1.AssertCommand.handle(argv, config_1.getFullConfig())
                .catch(failStart);
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
    process.exit(1);
}
//# sourceMappingURL=index.js.map