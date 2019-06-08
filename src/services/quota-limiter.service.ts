import Bottleneck from 'bottleneck';
import { interfaces } from 'inversify';
import { IApiQuota } from '../@types';
import { bindOnExitHandler } from './exit-handler.service';

export function getQuotaLimiterFactory(
  config: IApiQuota,
  isSingleton: boolean,
) {
  return (context: interfaces.Context) => {
    const limiter = new QuotaLimiterService(config);
    if (isSingleton) {
      bindOnExitHandler(() => limiter.dispose());
    }
    return limiter;
  };
}

export class QuotaLimiterService {
  static readonly DAY_MS = 24 * 60 * 60 * 1000;

  readonly dailyLimiter: Bottleneck;
  readonly limiter: Bottleneck;
  private _disposed: boolean;

  get disposed() {
    return this._disposed;
  }

  constructor(quota: IApiQuota) {
    this.dailyLimiter = new Bottleneck({
      reservoir: quota.daily,
      reservoirRefreshInterval: QuotaLimiterService.DAY_MS,
    });

    const plusOneInterval = quota.period / quota.queries;
    if (quota.burst) {
      // The library requires 250 granularity
      const increaseInterval = Math.ceil(plusOneInterval / 250) * 250;
      const increaseAmount = 250 / plusOneInterval;
      this.limiter = new Bottleneck({
        reservoir: quota.queries,
        reservoirIncreaseMaximum: quota.queries,
        reservoirIncreaseInterval: increaseInterval,
        reservoirIncreaseAmount: increaseAmount,
      });
    } else {
      this.limiter = new Bottleneck({
        // maxConcurrent: 10,
        minTime: plusOneInterval,
      });
    }
    this.limiter.chain(this.dailyLimiter);
    this._disposed = false;
  }

  dispose() {
    if (this._disposed) {
      return;
    }
    this.limiter.chain(undefined);
    this._disposed = true;
    return Promise.join(
      this.limiter.stop(),
      this.dailyLimiter.stop(),
      this.limiter.disconnect(),
      this.dailyLimiter.disconnect(),
    );
  }
}