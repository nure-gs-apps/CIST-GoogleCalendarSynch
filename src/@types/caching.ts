export interface IMaxCacheExpiration {
  hours: number;
  minutes: number;
}

export function assertMaxCacheExpiration(
  config: IMaxCacheExpiration,
): asserts config is IMaxCacheExpiration {
  if (
    typeof config !== 'object'
    || typeof config.hours !== 'number'
    || typeof config.minutes !== 'number'
    || !Number.isInteger(config.hours)
    || !Number.isInteger(config.minutes)
    || config.hours < 0
    || config.hours >= 24
    || config.minutes < 0
    || config.minutes >= 60
  ) {
    throw new TypeError(`Invalid cache expiration period: ${config.hours}:${config.minutes}`);
  }
}