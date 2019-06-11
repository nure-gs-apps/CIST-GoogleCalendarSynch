// NOTE: Make sure to import it in every entry point you have
import 'bluebird-global';
// import { shim } from 'array.prototype.flatmap';
// shim();

export type primitive =
  number
  | string
  | boolean
  | symbol
  | null
  | undefined
  | bigint;

export type Maybe<T> = T | null | undefined;
export type Nullable<T> = T | null;
export type Optional<T> = T | undefined;

export type DeepNonMaybe<T> = {
  [P in keyof T]: T[P] extends null | undefined ? never : T[P];
};

export type NullablePartial<T> = {
  [P in keyof T]?: Nullable<T[P]>;
};

export type DeepReadonly<T> = {
  readonly [P in keyof T]: DeepReadonly<T[P]>;
};

export type DeepPartial<T> = {
  [P in keyof T]?: DeepPartial<T[P]>;
};

export type DeepNullablePartial<T> = {
  [P in keyof T]?: Nullable<DeepNullablePartial<T[P]>>;
};

export interface IConfig {
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
}

export interface IApiQuota {
  daily: number;
  period: number;
  queries: number;
  perSecond?: number;
  burst: boolean;
}

export interface ICalendarConfig {
  prefix: Nullable<string>;
  timeZone: string;
}
