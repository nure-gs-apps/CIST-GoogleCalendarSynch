import * as yargs from 'yargs';
import { IApiQuota, ICalendarConfig, Nullable } from '../@types';
import { defaultConfigDirectory } from './constants';

export interface IFullAppConfig {
  // Keep the key in common camel case or environment config will break
  ncgc: {
    configDir?: string;
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

export function getBasicCliConfiguration(): yargs.Argv<IFullAppConfig> {
  const cistPrefix = nameof<IFullAppConfig>(c => c.ncgc.cist);
  const googlePrefix = nameof<IFullAppConfig>(c => c.ncgc.google);
  return yargs
    .option(toAppOption(nameof<IFullAppConfig>(c => c.ncgc.configDir)), {
      alias: '-d',
      type: 'string',
      default: defaultConfigDirectory,
    })
    .option(
      toAppOption(cistPrefix, nameof<AppConfig['cist']>(c => c.apiKey)),
      {
        type: 'string'
      }
    )
    .argv as any;
}

function toAppOption(...kebabCaseArgProps: string[]) {
  return `--${nameof<IFullAppConfig>(c => c.ncgc)}.${kebabCaseArgProps.join('.')}`;
}
