// IMPORTANT! INSTALLS MONKEY PATCHES
import './polyfills';
import iterate from 'iterare';
import { EOL } from 'os';
// import { Arguments } from 'yargs';
// import { DeepPartial } from './@types';
import {
  getFullConfig,
  getSupportedConfigExtensionsInPriorityOrder,
  initializeConfig,
} from './config';
import { getDefaultConfigDirectory } from './config/constants';
import {
  getBasicCliConfiguration,
  // IFullAppConfig
} from './config/types';
import {
  AssertCommand,
  assertHasEntities,
  // EntityType,
  IArgsWithEntities,
} from './main';
import { exitGracefully } from './services/exit-handler.service';
import { toPrintString } from './utils/common';
// import { toPrintString } from './utils/common';

const usage = `A script for synchronysing NURE CIST schedule to Google Calendar and Google Directory.

The script accepts command line options that override configuration of the script.
The options described in help to this script may not include all the properties. All possible values can be seen by default in "${getDefaultConfigDirectory()}".
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
${iterate(getSupportedConfigExtensionsInPriorityOrder()).reduce((str, ext) => `      - ${ext}${EOL}${str}`, '')}
      e.g. default.json will be overriden by default.yaml

Secondly, all configuration values can be overriden by environment variables.
All such configuration values are prefixed by NCGC__ regardless of case.
All environment configuration values are case-insensitive, snake-cased and have '__' to represent object nested values.
E.g. NCGC__SOME__NESTED_VALUE corresponds to ncgc.some.nestedValue
You can also use .env file configuration in this case.

Lastly, command line arguments are used. They are described at the beginning of this message and override all previously set values.
`;

const yargs = getBasicCliConfiguration()
  .usage(usage)
  .middleware(initializeMiddleware)
  .command('cache', 'CIST Cache utilities', (yargs) => {
    const groupsName = nameof<IArgsWithEntities>(a => a.groups);
    const auditoriesName = nameof<IArgsWithEntities>(a => a.auditories);
    const eventsName = nameof<IArgsWithEntities>(a => a.events);
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
        coerce(value: any) {
          const str = value as string;
          if (str === '' || str === 'all') {
            return [];
          }
          if (!value) {
            return null;
          }
          const initialArgs = str.split(/\s*,\s*/);
          const ids = iterate(initialArgs)
            .map(v => Number.parseInt(v, 10))
            .filter(v => !Number.isNaN(v))
            .toArray();
          if (ids.length === 0) {
            throw new TypeError('No Group IDs parsed');
          }
          if (initialArgs.length !== ids.length) {
            console.warn(`Only such IDs found: ${toPrintString(ids)}`);
          }
          return ids;
        },
        requiresArg: false,
      })
      .check(args => assertHasEntities(args as any))
      .command({
        command: 'assert',
        describe: 'Check responses for validity',
        handler(argv) {
          AssertCommand.handle(argv as IArgsWithEntities, getFullConfig())
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
  return initializeConfig(yargs);
}

function failStart(error: any) {
  console.error(error);
  exitGracefully(1);
}
