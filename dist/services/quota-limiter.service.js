"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const bottleneck_1 = require("bottleneck");
const object_1 = require("../@types/object");
const exit_handler_service_1 = require("./exit-handler.service");
function getQuotaLimiterFactory(configId, isSingleton) {
    return (context) => {
        const limiter = new QuotaLimiterService(context.container.get(configId));
        if (isSingleton) {
            exit_handler_service_1.bindOnExitHandler(() => limiter.dispose());
        }
        return limiter;
    };
}
exports.getQuotaLimiterFactory = getQuotaLimiterFactory;
class QuotaLimiterService extends object_1.Disposer {
    constructor(quota) {
        super(); // a doDispose() method override is used
        Object.defineProperty(this, "dailyLimiter", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "limiter", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
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
    }
    doDispose() {
        this.limiter.chain(undefined);
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