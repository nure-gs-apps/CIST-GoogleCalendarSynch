import * as yargs from 'yargs';
import { IApiQuota, ICalendarConfig, Nullable } from '../@types';
// import { defaultConfigDirectory } from './constants';

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

export function getBasicCliConfiguration(): yargs.Argv<IFullAppConfig> {
  return <any>yargs
    // .option(nameof.full<IFullAppConfig>(c => c.ncgc.configDir), {
    //   alias: '-d',
    //   type: 'string',
    //   default: defaultConfigDirectory,
    // });
}
