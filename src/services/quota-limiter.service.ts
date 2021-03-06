import Bottleneck from 'bottleneck';
import { interfaces } from 'inversify';
import { Disposer, IDisposable } from '../@types/object';
import { IApiQuota } from '../@types/services';
import { bindOnExitHandler } from './exit-handler.service';
import ServiceIdentifier = interfaces.ServiceIdentifier;

export function getQuotaLimiterFactory(
  configId: ServiceIdentifier<any>,
  isSingleton: boolean,
) {
  return (context: interfaces.Context) => {
    const limiter = new QuotaLimiterService(
      context.container.get<IApiQuota>(configId)
    );
    if (isSingleton) {
      bindOnExitHandler(() => limiter.dispose());
    }
    return limiter;
  };
}

export class QuotaLimiterService extends Disposer implements IDisposable {
  static readonly DAY_MS = 24 * 60 * 60 * 1000;

  readonly dailyLimiter: Bottleneck;
  readonly limiter: Bottleneck;

  constructor(quota: IApiQuota) {
    super(); // a doDispose() method override is used
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
        minTime: typeof quota.perSecond === 'number'
          ? 1000 / quota.perSecond
          : null,
      });
    } else {
      const minTime = typeof quota.perSecond === 'number'
        ? 1000 / quota.perSecond
        : null;
      this.limiter = new Bottleneck({
        minTime: typeof minTime === 'number' && minTime > plusOneInterval
          ? minTime
          : plusOneInterval,
      });
    }
    this.limiter.chain(this.dailyLimiter);
  }

  protected doDispose() {
    this.limiter.chain(undefined);
    return Promise.join(
      this.limiter.stop(),
      this.dailyLimiter.stop(),
      this.limiter.disconnect(),
      this.dailyLimiter.disconnect(),
    ) as Promise<any>;
  }
}
