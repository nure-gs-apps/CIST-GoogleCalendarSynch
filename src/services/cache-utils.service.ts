import { inject, injectable } from 'inversify';
import * as moment from 'moment-timezone';
import { ReadonlyDate } from 'readonly-date';
import { assertMaxCacheExpiration, IMaxCacheExpiration } from '../@types';
import { TYPES } from '../di/types';

@injectable()
export class CacheUtilsService {
  readonly maxCacheExpirationConfig: IMaxCacheExpiration;

  constructor(@inject(
    TYPES.CacheMaxExpiration
  ) maxCacheExpirationConfig: IMaxCacheExpiration) {
    assertMaxCacheExpiration(maxCacheExpirationConfig);
    this.maxCacheExpirationConfig = maxCacheExpirationConfig;
  }

  clampExpiration(
    date = new ReadonlyDate(),
    max = this.getMaxExpiration()
  ) {
    return max.valueOf() > date.valueOf() ? date : max;
  }

  getMaxExpiration(date = new ReadonlyDate()) {
    const expiration = moment(date.valueOf()).tz('Europe/Kiev');
    if (expiration.hours() >= 5) {
      expiration.add(1, 'day');
    }
    expiration.hours(this.maxCacheExpirationConfig.hours)
      .minutes(this.maxCacheExpirationConfig.minutes)
      .second(0)
      .milliseconds(0);
    return expiration.toDate() as ReadonlyDate;
  }
}
