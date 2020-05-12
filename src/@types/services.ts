import { Nullable } from './';

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

