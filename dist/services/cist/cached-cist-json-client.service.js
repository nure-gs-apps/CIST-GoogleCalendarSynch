"use strict";
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const fs_1 = require("fs");
const inversify_1 = require("inversify");
const path = require("path");
const _types_1 = require("../../@types");
const types_1 = require("../../config/types");
const types_2 = require("../../di/types");
const errors_1 = require("../../errors");
const cist_1 = require("../../utils/cist");
const common_1 = require("../../utils/common");
const cache_utils_service_1 = require("../cache-utils.service");
const file_cached_value_1 = require("../caching/file-cached-value");
const cist_json_http_events_cached_value_1 = require("./cist-json-http-events-cached-value");
const cist_json_http_groups_cached_value_1 = require("./cist-json-http-groups-cached-value");
// import { CistJsonHttpRoomsCachedValue } from './cist-json-http-rooms-cached-value';
const types_3 = require("./types");
let CachedCistJsonClientService = class CachedCistJsonClientService {
    constructor(cacheUtils, cacheConfig, 
    // tslint:disable-next-line:max-line-length
    http) {
        Object.defineProperty(this, _a, {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "_isDisposed", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "_cacheConfig", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "_cacheUtils", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "_baseDirectory", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "_http", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        // tslint:disable-next-line:max-line-length
        Object.defineProperty(this, "_eventsCachedValues", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        // tslint:disable-next-line:max-line-length
        Object.defineProperty(this, "_groupsCachedValue", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        // tslint:disable-next-line:max-line-length
        Object.defineProperty(this, "_roomsCachedValue", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this._cacheConfig = cacheConfig;
        this._cacheUtils = cacheUtils;
        this._eventsCachedValues = new Map();
        this._groupsCachedValue = null;
        this._roomsCachedValue = null;
        this._isDisposed = false;
        this[_types_1.ASYNC_INIT] = Promise.resolve();
        // File cache
        if (this.includesCache(types_1.CacheType.File)) {
            this._baseDirectory = path.resolve(common_1.PathUtils.expandVars(common_1.isWindows()
                ? this._cacheConfig.configs[types_1.CacheType.File].directory.win
                : this._cacheConfig.configs[types_1.CacheType.File].directory.unix));
            this[_types_1.ASYNC_INIT] = this[_types_1.ASYNC_INIT]
                .then(() => fs_1.promises.mkdir(this._baseDirectory, { recursive: true }));
        }
        else {
            this._baseDirectory = '.';
        }
        // HTTP source
        if (this.includesCache(types_1.CacheType.Http)) {
            if (!http) {
                throw new TypeError('Cist http client is not found!');
            }
            this._http = http;
        }
        else {
            this._http = null;
        }
    }
    get isDisposed() {
        return this._isDisposed;
    }
    async dispose() {
        const promises = [];
        if (this._groupsCachedValue) {
            promises.push(common_1.disposeChain(this._groupsCachedValue));
        }
        if (this._roomsCachedValue) {
            promises.push(common_1.disposeChain(this._roomsCachedValue));
        }
        for (const cachedValue of this._eventsCachedValues.values()) {
            promises.push(common_1.disposeChain(cachedValue));
        }
        if (promises.length > 0) {
            await Promise.all(promises);
        }
    }
    async getEventsResponse(type, entityId, dateLimits) {
        const params = { entityId, dateLimits, typeId: type };
        const hash = getEventsCacheFileNamePart(params);
        let cachedValue = this._eventsCachedValues.get(hash);
        if (!cachedValue) {
            cachedValue = await this.createEventsCachedValue(params);
            this._eventsCachedValues.set(hash, cachedValue);
        }
        const response = await cachedValue.loadValue();
        if (!response) {
            throw new TypeError(e('failed to find value in cache chain!'));
        }
        return response;
    }
    async getGroupsResponse() {
        if (!this._groupsCachedValue) {
            this._groupsCachedValue = await this.createGroupsCachedValue();
        }
        const response = await this._groupsCachedValue.loadValue();
        if (!response) {
            throw new TypeError(g('failed to find value in cache chain!'));
        }
        return response;
    }
    async getRoomsResponse() {
        if (!this._roomsCachedValue) {
            this._roomsCachedValue = await this.createRoomsCachedValue();
        }
        const response = await this._roomsCachedValue.loadValue();
        if (!response) {
            throw new TypeError(r('failed to find value in cache chain!'));
        }
        return response;
    }
    async destroyEventsCache() {
        for (const cachedValue of this._eventsCachedValues.values()) {
            await cachedValue.dispose();
        }
        this._eventsCachedValues.clear();
        const errors = [];
        if (this._cacheConfig.priorities.events.includes(types_1.CacheType.Http)) {
            const fileNames = await fs_1.promises.readdir(this._baseDirectory);
            for (const fileName of fileNames) {
                if (!isEventsCacheFile(fileName)) {
                    continue;
                }
                try {
                    const cachedValue = new file_cached_value_1.FileCachedValue(this._cacheUtils, path.join(this._baseDirectory, fileName));
                    if (cachedValue.isDestroyable) {
                        if (!cachedValue.isInitialized) {
                            await cachedValue.init();
                        }
                        await cachedValue.destroy();
                    }
                    else {
                        await cachedValue.dispose();
                    }
                }
                catch (error) {
                    errors.push(new errors_1.NestedError(`Failed to destroy cache at ${fileName}`, error));
                }
            }
        }
        if (errors.length > 0) {
            throw new errors_1.MultiError('Multiple exceptions happened', errors);
        }
    }
    async destroyGroupsCache() {
        if (!this._groupsCachedValue) {
            this._groupsCachedValue = await this.createGroupsCachedValue();
        }
        await common_1.destroyChain(this._groupsCachedValue);
        this._groupsCachedValue = null;
    }
    async destroyRoomsCache() {
        if (!this._roomsCachedValue) {
            this._roomsCachedValue = await this.createRoomsCachedValue();
        }
        await common_1.destroyChain(this._roomsCachedValue);
        this._roomsCachedValue = null;
    }
    async createGroupsCachedValue() {
        let cachedValue = null;
        for (let i = this._cacheConfig.priorities.groups.length - 1, type = this._cacheConfig.priorities.groups[i]; i >= 0; i -= 1, type = this._cacheConfig.priorities.groups[i]) {
            const oldCachedValue = cachedValue;
            switch (type) {
                case types_1.CacheType.Http:
                    if (!this._http) {
                        throw new TypeError(g('An initialized CIST HTTP client is required'));
                    }
                    cachedValue = new cist_json_http_groups_cached_value_1.CistJsonHttpGroupsCachedValue(this._cacheUtils, this._http);
                    if (!cachedValue.needsSource && oldCachedValue) {
                        throw new TypeError(g('HTTP requests must be last in the cache chain'));
                    }
                    if (!cachedValue.isInitialized) {
                        await cachedValue.init();
                    }
                    break;
                case types_1.CacheType.File:
                    cachedValue = new file_cached_value_1.FileCachedValue(this._cacheUtils, path.join(this._baseDirectory, getCacheFileName(types_3.EntityType.Groups)));
                    if (!cachedValue.isInitialized) {
                        await cachedValue.init();
                    }
                    await cachedValue.setSource(oldCachedValue);
                    break;
                default:
                    throw new TypeError(g(`Unknown type of cache: ${type}`));
            }
        }
        if (!cachedValue) {
            throw new TypeError(g('No cache sources found'));
        }
        return cachedValue;
    }
    async createRoomsCachedValue() {
        let cachedValue = null;
        for (let i = this._cacheConfig.priorities.auditories.length - 1, type = this._cacheConfig.priorities.auditories[i]; i >= 0; i -= 1, type = this._cacheConfig.priorities.auditories[i]) {
            const oldCachedValue = cachedValue;
            switch (type) {
                case types_1.CacheType.Http:
                    cachedValue = new file_cached_value_1.FileCachedValue(this._cacheUtils, '/var/tmp/ncgc/cache/cist/rooms.tmp.tmp');
                    if (!cachedValue.isInitialized) {
                        await cachedValue.init();
                    }
                    await cachedValue.setSource(oldCachedValue);
                    // if (!this._http) {
                    //   throw new TypeError(r('An initialized CIST HTTP client is required'));
                    // }
                    // cachedValue = new CistJsonHttpRoomsCachedValue(
                    //   this._cacheUtils,
                    //   this._http
                    // );
                    // if (!cachedValue.needsSource && oldCachedValue) {
                    //   throw new TypeError(r('HTTP requests must be last in the cache chain'));
                    // }
                    // if (!cachedValue.isInitialized) {
                    //   await cachedValue.init();
                    // }
                    break;
                case types_1.CacheType.File:
                    cachedValue = new file_cached_value_1.FileCachedValue(this._cacheUtils, path.join(this._baseDirectory, getCacheFileName(types_3.EntityType.Rooms)));
                    if (!cachedValue.isInitialized) {
                        await cachedValue.init();
                    }
                    await cachedValue.setSource(oldCachedValue);
                    break;
                default:
                    throw new TypeError(r(`Unknown type of cache: ${type}`));
            }
        }
        if (!cachedValue) {
            throw new TypeError(r('No cache sources found'));
        }
        return cachedValue;
    }
    async createEventsCachedValue(params) {
        let cachedValue = null;
        for (let i = this._cacheConfig.priorities.events.length - 1, type = this._cacheConfig.priorities.events[i]; i >= 0; i -= 1, type = this._cacheConfig.priorities.events[i]) {
            const oldCachedValue = cachedValue;
            switch (type) {
                case types_1.CacheType.Http:
                    if (!this._http) {
                        throw new TypeError(e('An initialized CIST HTTP client is required'));
                    }
                    cachedValue = new cist_json_http_events_cached_value_1.CistJsonHttpEventsCachedValue(this._cacheUtils, this._http, params);
                    if (!cachedValue.needsSource && oldCachedValue) {
                        throw new TypeError(e('HTTP requests must be last in the cache chain'));
                    }
                    if (!cachedValue.isInitialized) {
                        await cachedValue.init();
                    }
                    break;
                case types_1.CacheType.File:
                    cachedValue = new file_cached_value_1.FileCachedValue(this._cacheUtils, path.join(this._baseDirectory, getCacheFileName(types_3.EntityType.Events, params)));
                    if (!cachedValue.isInitialized) {
                        await cachedValue.init();
                    }
                    await cachedValue.setSource(oldCachedValue);
                    break;
                default:
                    throw new TypeError(e(`Unknown type of cache: ${type}`));
            }
        }
        if (!cachedValue) {
            throw new TypeError(e('No cache sources found'));
        }
        return cachedValue;
    }
    includesCache(type) {
        return cist_1.includesCache(this._cacheConfig, type);
    }
};
_a = _types_1.ASYNC_INIT;
CachedCistJsonClientService = tslib_1.__decorate([
    inversify_1.injectable(),
    tslib_1.__param(0, inversify_1.inject(types_2.TYPES.CacheUtils)),
    tslib_1.__param(1, inversify_1.inject(types_2.TYPES.CistCacheConfig)),
    tslib_1.__param(2, inversify_1.inject(types_2.TYPES.CistJsonHttpClient)), tslib_1.__param(2, inversify_1.optional()),
    tslib_1.__metadata("design:paramtypes", [cache_utils_service_1.CacheUtilsService, Object, Object])
], CachedCistJsonClientService);
exports.CachedCistJsonClientService = CachedCistJsonClientService;
const separator = '.';
function getCacheFileName(type, options) {
    let hash = type.toString();
    if (options) {
        hash += separator + getEventsCacheFileNamePart(options);
    }
    return `${hash}.tmp`;
}
function getEventsCacheFileNamePart(options) {
    let hash = options.typeId.toString() + separator + options.entityId;
    if (options.dateLimits && (options.dateLimits.from || options.dateLimits.to)) {
        hash += separator;
        if (options.dateLimits.from) {
            hash += common_1.dateToSeconds(options.dateLimits.from);
        }
        if (options.dateLimits.to) {
            hash += separator + common_1.dateToSeconds(options.dateLimits.to);
        }
    }
    return hash;
}
const fileNameRegex = new RegExp(`^${types_3.EntityType.Events}\\.[1-3]\\.\\d+(\\.(\\d*\\.\\d+|\\d+\\.))?\\.tmp$`);
function isEventsCacheFile(fileName) {
    return fileNameRegex.test(fileName);
}
function r(text) {
    return `CIST Auditories: ${text}`;
}
function e(text) {
    return `CIST Events: ${text}`;
}
function g(text) {
    return `CIST Groups: ${text}`;
}
//# sourceMappingURL=cached-cist-json-client.service.js.map