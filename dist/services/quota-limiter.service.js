"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const bottleneck_1 = require("bottleneck");
const exit_handler_service_1 = require("./exit-handler.service");
function getQuotaLimiterFactory(config, isSingleton) {
    return (context) => {
        const limiter = new QuotaLimiterService(config);
        if (isSingleton) {
            exit_handler_service_1.bindOnExitHandler(() => limiter.dispose());
        }
        return limiter;
    };
}
exports.getQuotaLimiterFactory = getQuotaLimiterFactory;
class QuotaLimiterService {
    constructor(quota) {
        Object.defineProperty(this, "dailyLimiter", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: dailyLimiter
        });
        Object.defineProperty(this, "limiter", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: limiter
        });
        Object.defineProperty(this, "_disposed", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: _disposed
        });
        this.dailyLimiter = new bottleneck_1.default({
            reservoir: quota.daily,
            reservoirRefreshInterval: QuotaLimiterService.DAY_MS,
        });
        const plusOneInterval = quota.period / quota.queries;
        if (quota.burst) {
            // The library requires 250 granularity
            const increaseInterval = Math.ceil(plusOneInterval / 250) * 250;
            const increaseAmount = 250 / plusOneInterval;
            this.limiter = new bottleneck_1.default({
                reservoir: quota.queries,
                reservoirIncreaseMaximum: quota.queries,
                reservoirIncreaseInterval: increaseInterval,
                reservoirIncreaseAmount: increaseAmount,
                minTime: typeof quota.perSecond === 'number'
                    ? 1000 / quota.perSecond
                    : null,
            });
        }
        else {
            const minTime = typeof quota.perSecond === 'number'
                ? 1000 / quota.perSecond
                : null;
            this.limiter = new bottleneck_1.default({
                minTime: typeof minTime === 'number' && minTime > plusOneInterval
                    ? minTime
                    : plusOneInterval,
            });
        }
        this.limiter.chain(this.dailyLimiter);
        this._disposed = false;
    }
    get disposed() {
        return this._disposed;
    }
    dispose() {
        if (this._disposed) {
            return;
        }
        this.limiter.chain(undefined);
        this._disposed = true;
        return Promise.join(this.limiter.stop(), this.dailyLimiter.stop(), this.limiter.disconnect(), this.dailyLimiter.disconnect());
    }
}
exports.QuotaLimiterService = QuotaLimiterService;
Object.defineProperty(QuotaLimiterService, "DAY_MS", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: 24 * 60 * 60 * 1000
});
//# sourceMappingURL=quota-limiter.service.js.map