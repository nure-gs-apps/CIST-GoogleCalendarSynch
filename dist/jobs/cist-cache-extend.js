"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const readonly_date_1 = require("readonly-date");
const cist_1 = require("../@types/cist");
const container_1 = require("../di/container");
const types_1 = require("../di/types");
const cache_utils_service_1 = require("../services/caching/cache-utils.service");
const cached_cist_json_client_service_1 = require("../services/cist/cached-cist-json-client.service");
const exit_handler_service_1 = require("../services/exit-handler.service");
const common_1 = require("../utils/common");
const jobs_1 = require("../utils/jobs");
async function handleCistCacheExtend(args, newExpiration, config) {
    const types = jobs_1.getCistCachedClientTypesForArgs(args, config.ncgc.caching.cist.priorities);
    const container = container_1.createContainer({
        types,
        skip: [types_1.TYPES.CacheUtils]
    });
    exit_handler_service_1.bindOnExitHandler(container_1.disposeContainer);
    container.bind(types_1.TYPES.CacheUtils)
        .toConstantValue(new CacheUtilsServiceWithExpiration(// might be dangerous due to singleton scope
    container.get(types_1.TYPES.CacheMaxExpiration), newExpiration));
    container.bind(types_1.TYPES.CistJsonClient)
        .toDynamicValue(cached_cist_json_client_service_1.getSharedCachedCistJsonClientInstance);
    await container_1.getContainerAsyncInitializer([cache_utils_service_1.CacheUtilsService]);
    const cistClient = container
        .get(types_1.TYPES.CistJsonClient);
    const dispose = async () => {
        await cistClient.dispose();
    };
    exit_handler_service_1.bindOnExitHandler(dispose);
    if (args.auditories) {
        await cistClient.setRoomsCacheExpiration(newExpiration);
    }
    if (args.groups) {
        await cistClient.setGroupsCacheExpiration(newExpiration);
    }
    if (args.events) {
        let groupIds;
        if (args.events.length === 0) {
            const groupsResponse = await cistClient.getGroupsResponse();
            groupIds = common_1.toGroupIds(groupsResponse);
        }
        else {
            groupIds = args.events;
        }
        const promises = [];
        for (const groupId of groupIds) {
            promises.push(cistClient.setEventsCacheExpiration(newExpiration, cist_1.TimetableType.Group, groupId));
        }
        await Promise.all(promises);
    }
    await dispose();
    exit_handler_service_1.unbindOnExitHandler(dispose);
    exit_handler_service_1.exitGracefully(0);
}
exports.handleCistCacheExtend = handleCistCacheExtend;
class CacheUtilsServiceWithExpiration extends cache_utils_service_1.CacheUtilsService {
    constructor(maxCacheExpirationConfig, maxCacheExpiration) {
        super(maxCacheExpirationConfig);
        Object.defineProperty(this, "_maxCacheExpiration", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this._maxCacheExpiration = maxCacheExpiration;
    }
    getMaxExpiration(date = new readonly_date_1.ReadonlyDate()) {
        if (date.valueOf() < this._maxCacheExpiration.valueOf()) {
            return this._maxCacheExpiration;
        }
        return super.getMaxExpiration(date);
    }
}
//# sourceMappingURL=cist-cache-extend.js.map