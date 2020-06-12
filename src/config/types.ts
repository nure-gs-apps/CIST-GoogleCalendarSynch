/* tslint:disable:ter-indent */
import { paramCase } from 'change-case';
import { JWTInput } from 'google-auth-library';
import * as yargs from 'yargs';
import { DeepPartial, Nullable } from '../@types';
import { IMaxCacheExpiration } from '../@types/caching';
import { GoogleAuthKey } from '../@types/google';
import { IApiQuota, ICalendarConfig } from '../@types/services';
import { TaskProgressBackend } from '../@types/tasks';
import { ICrossPlatformFilePath } from '../@types/utils';
import { parseDuration } from '../utils/common';
import { getDefaultConfigDirectory } from './constants';
import { getConfig } from './index';

export enum CacheType {
  File = 'file',
  Http = 'http'
}

export interface IFullAppConfig {
  // Keep the key in common camel case or environment config will break
  ncgc: {
    configDir: string;
    nureAddress: string;
    tasks: {
      concurrency: number;
      timeout: string;
      progress: {
        backend: TaskProgressBackend;
        backendConfigs: {
          [TaskProgressBackend.File]: ICrossPlatformFilePath;
        };
      };
    };
    caching: {
      maxExpiration: IMaxCacheExpiration;
      cist: {
        priorities: {
          auditories: CacheType[];
          groups: CacheType[];
          events: CacheType[];
        };
        configs: {
          [CacheType.File]: {
            directory: ICrossPlatformFilePath;
          };
        };
      };
    };
    cist: {
      baseUrl: string;
      apiKey: string;
    };
    google: {
      idPrefix: Nullable<string>;
      groupEmailPrefix: Nullable<string>;
      calendar: ICalendarConfig;
      auth: {
        adminDirectoryKey: Nullable<string | JWTInput>;
        calendarKey: Nullable<string | JWTInput>
        adminSubjectEmail: string;
      };
      quotas: {
        adminDirectoryApi: IApiQuota;
        calendarApi: IApiQuota;
      };
    };
  };
}

export type AppConfig = IFullAppConfig['ncgc'];

export type GoogleAuthConfigKey = Nullable<GoogleAuthKey>;

export type CistCacheConfig = AppConfig['caching']['cist'];

export function getBasicCliConfiguration(
): yargs.Argv<DeepPartial<IFullAppConfig>> {
  // FIXME: add overrides for quotas object (seems too long options)
  return yargs
    .parserConfiguration({
      'sort-commands': false,
      'boolean-negation': true,
      'camel-case-expansion': true,
      'combine-arrays': true,
      'dot-notation': true, // IMPORTANT!
      'duplicate-arguments-array': true,
      'flatten-duplicate-arrays': false,
      'halt-at-non-option': false,
      'negation-prefix': 'no-',
      'parse-numbers': true,
      'populate--': false,
      'set-placeholder-key': false,
      'short-option-groups': true,
      'strip-aliased': true,
      'strip-dashed': true,
      'unknown-options-as-args': true // allows usage of undocumented options (not in help)
    })
    .option(o(nameof.full<IFullAppConfig>(c => c.ncgc.configDir)), {
      alias: ['config'],
      type: 'string', // TODO: add regex for path
      default: getDefaultConfigDirectory(),
      description: 'Path to directory of configs',
    })
    .option(o(nameof.full<IFullAppConfig>(c => c.ncgc.cist.baseUrl)), {
      type: 'string',
      description: 'NURE CIST server URL with path to API', // TODO: add regex for path
    })
    .option(o(nameof.full<IFullAppConfig>(c => c.ncgc.cist.apiKey)), {
      type: 'string',
      description: 'NURE CIST Events API key (requested manually from NURE CIST authorities)',
    })
    .option(o(nameof.full<IFullAppConfig>(c => c.ncgc.google.idPrefix)), {
      type: 'string',
      description: 'Prefix used in IDs of the system for Google Calendar entities (buildings, rooms, etc.)',  // TODO: add regex for prefix
    })
    // TODO: add prefix for calendar if needed
    .option(
      o(nameof.full<IFullAppConfig>(c => c.ncgc.google.calendar.timeZone)),
      {
        type: 'string',
        description: 'Google Calendar\'s timezone', // TODO: add regex for timezone
      }
    )
    .option(
      o(nameof.full<IFullAppConfig>(c => c.ncgc.google.auth.adminSubjectEmail)),
      {
        type: 'string',
        description: 'Google G-Suite\'s user email on behalf of which manipulations are done',  // TODO: add regex for email
      }
    )
    // .option(
    //   o(nameof.full<IFullAppConfig>(c => c.ncgc.google.auth.keyFilepath)),
    //   {
    //     type: 'string',
    //     description: 'Google G-Suite\'s path to file with JSON key', // TODO: add regex for path
    //   }
    // )
    ;
}

export function assertConfigPrefixId() {
  const config = getConfig();
  const idPrefix = config.google.idPrefix; // TODO: move to helper service
  const prefixIsValid = idPrefix === null || idPrefix === '' || (
    typeof idPrefix === 'string'
    && /^\w+$/.test(idPrefix)
  );
  if (!prefixIsValid) {
    throw new TypeError('idPrefix must be a alphanumeric string or null to omit');
  }
}

export function parseTasksTimeout(config = getConfig()) {
  return parseDuration(config.tasks.timeout, 'Task running timeout ');
}

function o(paramName: string) {
  return paramName
    .split('.')
    .map(p => paramCase(p, {}))
    .join('.');
}
