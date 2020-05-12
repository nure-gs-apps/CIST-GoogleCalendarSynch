"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const inversify_1 = require("inversify");
const moment = require("moment-timezone");
const readonly_date_1 = require("readonly-date");
const caching_1 = require("../../@types/caching");
const types_1 = require("../../di/types");
let CacheUtilsService = class CacheUtilsService {
    constructor(maxCacheExpirationConfig) {
        Object.defineProperty(this, "maxCacheExpirationConfig", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        caching_1.assertMaxCacheExpiration(maxCacheExpirationConfig);
        this.maxCacheExpirationConfig = maxCacheExpirationConfig;
    }
    clampExpiration(date = new readonly_date_1.ReadonlyDate(), max = this.getMaxExpiration()) {
        return max.valueOf() > date.valueOf() ? date : max;
    }
    getMaxExpiration(date = new readonly_date_1.ReadonlyDate()) {
        const expiration = moment(date.valueOf()).tz('Europe/Kiev');
        if (expiration.hours() >= 5) {
            expiration.add(1, 'day');
        }
        expiration.hours(this.maxCacheExpirationConfig.hours)
            .minutes(this.maxCacheExpirationConfig.minutes)
            .second(0)
            .milliseconds(0);
        return expiration.toDate();
    }
    assertValidExpiration(date) {
        if (date.valueOf() > this.getMaxExpiration().valueOf()) {
            throw new TypeError('Cache expiration cannot exceed 5 hours in the morning');
        }
    }
};
CacheUtilsService = tslib_1.__decorate([
    inversify_1.injectable(),
    tslib_1.__param(0, inversify_1.inject(types_1.TYPES.CacheMaxExpiration)),
    tslib_1.__metadata("design:paramtypes", [Object])
], CacheUtilsService);
exports.CacheUtilsService = CacheUtilsService;
//# sourceMappingURL=cache-utils.service.js.map