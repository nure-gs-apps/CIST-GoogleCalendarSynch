#!/usr/bin/env node
// IMPORTANT! INSTALLS MONKEY PATCHES
import './polyfills';
import iterate from 'iterare';
import { EOL } from 'os';
import { IEntitiesToOperateOn } from './@types/jobs';
import {
  addEntitiesOptions, addEntitiesToRemoveOptions,
  IArgsWithEntities,
} from './cli/common';
import {
  getFullConfig,
  getSupportedConfigExtensionsInPriorityOrder,
  initializeConfig,
} from './config';
import { getDefaultConfigDirectory } from './config/constants';
import {
  getBasicCliConfiguration,
} from './config/types';
import { handleCistCacheExtend } from './jobs/cist-cache-extend';
// import { handleFinishTask } from './jobs/finish-task';
import { IEntitiesToRemove, RunTasksJob } from './jobs/run-tasks.class';
import { exitGracefully, setExitLogger } from './services/exit-handler.service';
import { handleCistAssert } from './jobs/cist-assert';
import * as packageInfo from '../package.json';

setExitLogger(console);

const usage = `A script for synchronysing NURE CIST schedule to Google Calendar and Google Admin Directory.

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

export interface ICistCacheExtendOptions extends IArgsWithEntities {
  expiration: Date;
}

const yargs = getBasicCliConfiguration()
  .usage(usage)
  .scriptName(packageInfo.name)
  .middleware(initializeMiddleware)
  .help('help').alias('h', 'help')
  .showHelpOnFail(true)
  .command('cist', 'CIST Commands', (yargs) => {
    const expirationArg = nameof<ICistCacheExtendOptions>(o => o.expiration);
    return yargs
      .help('help').alias('h', 'help')
      .command({
        command: 'assert',
        describe: 'Check responses for validity',
        handler(argv) {
          handleCistAssert(
            argv as IArgsWithEntities,
            getFullConfig(),
            console,
          ).catch(handleError);
        },
        builder(yargs) {
          return addEntitiesOptions(yargs)
            .help('help').alias('h', 'help');
        }
      })
      .command({
        command: `extend-cache`,
        describe: 'Extend cache expiration',
        handler(argv) {
          const args = argv as ICistCacheExtendOptions;
          handleCistCacheExtend(args, args.expiration, getFullConfig())
            .catch(handleError);
        },
        builder(yargs) {
          return addEntitiesOptions(yargs)
            .help('help').alias('h', 'help')
            .option(expirationArg, {
              type: 'string',
              alias: ['date', 'd', 'exp'],
              demandOption: true,
              describe: 'New expiration to set. Preferably ISO-8601 date-time string or date only.',
              coerce(value: string) {
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
    describe: `Synchronize with CIST schedule with G Suite & Google Calendar. Common flags (${nameof<IEntitiesToOperateOn>(e => e.groups)}, ${nameof<IEntitiesToOperateOn>(e => e.auditories)}, ${nameof<IEntitiesToOperateOn>(e => e.events)}) are used for upload to Google, removal of irrelevant is done with additional flags.`,
    handler(argv) {
      new RunTasksJob(
        getFullConfig(),
        console,
        argv as IArgsWithEntities & IEntitiesToRemove,
      ).handle().catch(handleError);
    },
    builder(yargs) {
      return addEntitiesToRemoveOptions(
        addEntitiesOptions(yargs, false)
      )
        .help('help').alias('h', 'help')
        .command({
          command: 'finish',
          describe: 'Finish interrupted synchronization task.',
          builder(yargs) {
            return yargs
              .help('help').alias('h', 'help');
          },
          handler(argv) {
            new RunTasksJob(
              getFullConfig(),
              console,
            ).handle().catch(handleError);
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
  return initializeConfig(yargs);
}

function handleError(error: any) {
  console.error(error);
  exitGracefully(1);
}
