/* tslint:disable:ter-indent */
import * as yargs from 'yargs';
import { DeepPartial, IApiQuota, ICalendarConfig, Nullable } from '../@types';
import { getDefaultConfigDirectory } from './constants';
import { paramCase } from 'change-case';

export interface IFullAppConfig {
  // Keep the key in common camel case or environment config will break
  ncgc: {
    configDir: string;
    cist: {
      baseUrl: string;
      apiKey: string;
    };
    google: {
      idPrefix: Nullable<string>;
      calendar: ICalendarConfig;
      auth: {
        subjectEmail: string;
        keyFilepath: string;
      };
      quotas: {
        directoryApi: IApiQuota;
        calendarApi: IApiQuota;
      };
    };
  };
}

export type AppConfig = IFullAppConfig['ncgc'];

export function getBasicCliConfiguration(
): yargs.Argv<DeepPartial<IFullAppConfig>> {
  // FIXME: add overrides for quotas object (seems to long options)
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
      alias: 'd',
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
      o(nameof.full<IFullAppConfig>(c => c.ncgc.google.auth.subjectEmail)),
      {
        type: 'string',
        description: 'Google G-Suite\'s user email on behalf of which manipulations are done',  // TODO: add regex for email
      }
    )
    .option(
      o(nameof.full<IFullAppConfig>(c => c.ncgc.google.auth.keyFilepath)),
      {
        type: 'string',
        description: 'Google G-Suite\'s path to file with JSON key', // TODO: add regex for path
      }
    );
}

function o(paramName: string) {
  return paramName
    .split('.')
    .map(p => paramCase(p, {}))
    .join('.');
}
