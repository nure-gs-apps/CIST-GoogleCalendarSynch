// IMPORTANT! INSTALLS MONKEY PATCHES
import './polyfills';
import { Container } from 'inversify';
import iterate from 'iterare';
import { EOL } from 'os';
import { DeepPartial, Nullable } from './@types';
import {
  getSupportedConfigExtensionsInPriorityOrder,
  initializeConfig,
} from './config';
import { getDefaultConfigDirectory } from './config/constants';
import { getBasicCliConfiguration } from './config/types';
import { createContainer, getAsyncInitializer } from './di/container';
import { IAssertOptions } from './handlers';

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
    handler(args: DeepPartial<IAssertOptions>) {
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

let mod: Nullable<typeof import('./handlers')> = null;
let container: Nullable<Container> = null;
function initializeMiddleware() {
  return initializeConfig(yargs).then(() => {
    const c = createContainer();
    return getAsyncInitializer()
      .then(() => {
        container = c;
      })
      .then(() => import('./handlers'))
      .then(m => mod = m);
  });
}

function failStart(error: any) {
  console.error(error);
  process.exit(1);
}
