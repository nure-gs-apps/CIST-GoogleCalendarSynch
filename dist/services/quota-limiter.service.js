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
            });
        }
        else {
            this.limiter = new bottleneck_1.default({
                minTime: plusOneInterval,
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
QuotaLimiterService.DAY_MS = 24 * 60 * 60 * 1000;
exports.QuotaLimiterService = QuotaLimiterService;
//# sourceMappingURL=quota-limiter.service.js.map