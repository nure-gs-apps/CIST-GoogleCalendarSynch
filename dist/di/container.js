"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const object_1 = require("../@types/object");
const google_auth_admin_directory_1 = require("../services/google/google-auth-admin-directory");
const logger_service_1 = require("../services/logger.service");
const types_1 = require("./types");
const config_1 = require("../config");
const inversify_1 = require("inversify");
const config_service_1 = require("../config/config.service");
const cache_utils_service_1 = require("../services/caching/cache-utils.service");
const cached_cist_json_client_service_1 = require("../services/cist/cached-cist-json-client.service");
const cist_json_http_client_service_1 = require("../services/cist/cist-json-http-client.service");
const cist_json_http_parser_service_1 = require("../services/cist/cist-json-http-parser.service");
const buildings_service_1 = require("../services/google/buildings.service");
const calendar_service_1 = require("../services/google/calendar.service");
const events_service_1 = require("../services/google/events.service");
const google_api_calendar_1 = require("../services/google/google-api-calendar");
const google_api_admin_directory_1 = require("../services/google/google-api-admin-directory");
const groups_service_1 = require("../services/google/groups.service");
const rooms_service_1 = require("../services/google/rooms.service");
const google_utils_service_1 = require("../services/google/google-utils.service");
const quota_limiter_service_1 = require("../services/quota-limiter.service");
let container = null;
let boundTypes = null;
function hasContainer() {
    return !!container;
}
exports.hasContainer = hasContainer;
function createContainer(options) {
    const { forceNew, types: typesIterable, skip: skipIterable } = Object.assign({
        forceNew: false,
        skip: [],
        types: [],
    }, options);
    if (!forceNew && container) {
        throw new TypeError('Container is already created');
    }
    const skip = new Set(skipIterable);
    const types = new Set(typesIterable);
    const allRequired = types.size === 0;
    const defaultScope = inversify_1.BindingScopeEnum.Singleton;
    container = new inversify_1.Container({
        defaultScope,
        autoBindInjectable: true,
    });
    if ((allRequired || types.has(cached_cist_json_client_service_1.CachedCistJsonClientService)) && !skip.has(cached_cist_json_client_service_1.CachedCistJsonClientService)) {
        types.add(types_1.TYPES.CacheUtils);
        types.add(types_1.TYPES.CistCacheConfig);
    }
    if ((allRequired || types.has(cist_json_http_client_service_1.CistJsonHttpClient)) && !skip.has(cist_json_http_client_service_1.CistJsonHttpClient)) {
        types.add(types_1.TYPES.CistBaseApiUrl);
        types.add(types_1.TYPES.CistApiKey);
        types.add(types_1.TYPES.CistJsonHttpParser);
    }
    if ((allRequired || (types.has(types_1.TYPES.CistJsonHttpClient)
        || types.has(cist_json_http_client_service_1.CistJsonHttpClient)) && !types.has(cached_cist_json_client_service_1.CachedCistJsonClientService)) && !skip.has(cist_json_http_client_service_1.CistJsonHttpClient) && !skip.has(types_1.TYPES.CistJsonHttpClient)) {
        container.bind(types_1.TYPES.CistJsonHttpClient)
            .to(cist_json_http_client_service_1.CistJsonHttpClient);
    }
    if ((allRequired
        || types.has(types_1.TYPES.CacheUtils)
        || types.has(cache_utils_service_1.CacheUtilsService)) && !skip.has(cache_utils_service_1.CacheUtilsService) && !skip.has(types_1.TYPES.CacheUtils)) {
        container.bind(types_1.TYPES.CacheUtils).to(cache_utils_service_1.CacheUtilsService);
        types.add(types_1.TYPES.CacheMaxExpiration);
    }
    if ((allRequired
        || types.has(types_1.TYPES.CistJsonHttpParser)
        || types.has(cist_json_http_parser_service_1.CistJsonHttpParserService))
        && !skip.has(cist_json_http_parser_service_1.CistJsonHttpParserService)
        && !skip.has(types_1.TYPES.CistJsonHttpParser)) {
        container.bind(types_1.TYPES.CistJsonHttpParser)
            .to(cist_json_http_parser_service_1.CistJsonHttpParserService);
    }
    if ((allRequired
        || types.has(types_1.TYPES.BuildingsService)
        || types.has(buildings_service_1.BuildingsService))
        && !skip.has(buildings_service_1.BuildingsService)
        && !skip.has(types_1.TYPES.BuildingsService)) {
        container.bind(types_1.TYPES.BuildingsService)
            .to(buildings_service_1.BuildingsService);
        types.add(types_1.TYPES.GoogleApiAdminDirectory);
        types.add(types_1.TYPES.GoogleAdminDirectoryQuotaLimiter);
        types.add(types_1.TYPES.GoogleUtils);
        types.add(types_1.TYPES.Logger);
    }
    if ((allRequired
        || types.has(types_1.TYPES.RoomsService)
        || types.has(rooms_service_1.RoomsService))
        && !skip.has(rooms_service_1.RoomsService)
        && !skip.has(types_1.TYPES.RoomsService)) {
        container.bind(types_1.TYPES.RoomsService)
            .to(rooms_service_1.RoomsService);
        types.add(types_1.TYPES.GoogleApiAdminDirectory);
        types.add(types_1.TYPES.GoogleAdminDirectoryQuotaLimiter);
        types.add(types_1.TYPES.GoogleUtils);
        types.add(types_1.TYPES.Logger);
    }
    if ((allRequired
        || types.has(types_1.TYPES.GroupsService)
        || types.has(groups_service_1.GroupsService))
        && !skip.has(groups_service_1.GroupsService)
        && !skip.has(types_1.TYPES.GroupsService)) {
        container.bind(types_1.TYPES.GroupsService)
            .to(groups_service_1.GroupsService);
        types.add(types_1.TYPES.GoogleApiAdminDirectory);
        types.add(types_1.TYPES.GoogleAdminDirectoryQuotaLimiter);
        types.add(types_1.TYPES.GoogleUtils);
        types.add(types_1.TYPES.Logger);
    }
    if ((allRequired
        || types.has(types_1.TYPES.GoogleApiAdminDirectory)
        || types.has(google_api_admin_directory_1.GoogleApiAdminDirectory))
        && !skip.has(google_api_admin_directory_1.GoogleApiAdminDirectory)
        && !skip.has(types_1.TYPES.GoogleApiAdminDirectory)) {
        container.bind(types_1.TYPES.GoogleApiAdminDirectory)
            .to(google_api_admin_directory_1.GoogleApiAdminDirectory);
        types.add(types_1.TYPES.GoogleAuthAdminDirectory);
    }
    if ((allRequired
        || types.has(types_1.TYPES.GoogleAuthAdminDirectory)
        || types.has(google_auth_admin_directory_1.GoogleAuthAdminDirectory))
        && !skip.has(google_auth_admin_directory_1.GoogleAuthAdminDirectory)
        && !skip.has(types_1.TYPES.GoogleAuthAdminDirectory)) {
        container.bind(types_1.TYPES.GoogleAuthAdminDirectory)
            .to(google_auth_admin_directory_1.GoogleAuthAdminDirectory);
        types.add(types_1.TYPES.Logger);
        types.add(types_1.TYPES.GoogleAuthAdminDirectoryKey);
    }
    if ((allRequired || types.has(types_1.TYPES.GoogleAdminDirectoryQuotaLimiter)) && !skip.has(types_1.TYPES.GoogleAdminDirectoryQuotaLimiter)) {
        container.bind(types_1.TYPES.GoogleAdminDirectoryQuotaLimiter)
            .toDynamicValue(quota_limiter_service_1.getQuotaLimiterFactory(types_1.TYPES.GoogleAdminDirectoryQuotaLimiterConfig, defaultScope === inversify_1.BindingScopeEnum.Singleton));
        types.add(types_1.TYPES.GoogleAdminDirectoryQuotaLimiterConfig);
    }
    if ((allRequired || types.has(types_1.TYPES.GoogleCalendarQuotaLimiter)) && !skip.has(types_1.TYPES.GoogleCalendarQuotaLimiter)) {
        container.bind(types_1.TYPES.GoogleCalendarQuotaLimiter)
            .toDynamicValue(quota_limiter_service_1.getQuotaLimiterFactory(types_1.TYPES.GoogleCalendarQuotaLimiterConfig, defaultScope === inversify_1.BindingScopeEnum.Singleton));
        types.add(types_1.TYPES.GoogleCalendarQuotaLimiterConfig);
    }
    if ((allRequired
        || types.has(types_1.TYPES.GoogleUtils)
        || types.has(google_utils_service_1.GoogleUtilsService))
        && !skip.has(google_utils_service_1.GoogleUtilsService)
        && !skip.has(types_1.TYPES.GoogleUtils)) {
        container.bind(types_1.TYPES.GoogleUtils)
            .to(google_utils_service_1.GoogleUtilsService);
        types.add(types_1.TYPES.GoogleAuthSubject);
        types.add(types_1.TYPES.GoogleEntityIdPrefix);
    }
    if ((allRequired || types.has(types_1.TYPES.Logger)) && !skip.has(types_1.TYPES.Logger)) {
        container.bind(types_1.TYPES.Logger).toConstantValue(logger_service_1.logger);
    }
    // Constants
    if ((allRequired || types.has(types_1.TYPES.CistCacheConfig)) && !skip.has(types_1.TYPES.CistCacheConfig)) {
        container.bind(types_1.TYPES.CistCacheConfig)
            .toConstantValue(config_1.getConfig().caching.cist);
    }
    if ((allRequired || types.has(types_1.TYPES.CacheMaxExpiration)) && !skip.has(types_1.TYPES.CacheMaxExpiration)) {
        container.bind(types_1.TYPES.CacheMaxExpiration)
            .toConstantValue(config_1.getConfig().caching.maxExpiration);
    }
    if ((allRequired || types.has(types_1.TYPES.CistApiKey)) && !skip.has(types_1.TYPES.CistApiKey)) {
        container.bind(types_1.TYPES.CistApiKey).toConstantValue(config_1.getConfig().cist.apiKey);
    }
    if ((allRequired || types.has(types_1.TYPES.CistBaseApiUrl)) && !skip.has(types_1.TYPES.CistBaseApiUrl)) {
        container.bind(types_1.TYPES.CistBaseApiUrl).toConstantValue(config_1.getConfig().cist.baseUrl);
    }
    if ((allRequired || types.has(types_1.TYPES.GoogleAuthAdminDirectoryKey)) && !skip.has(types_1.TYPES.GoogleAuthAdminDirectoryKey)) {
        container.bind(types_1.TYPES.GoogleAuthAdminDirectoryKey)
            .toConstantValue(config_1.getConfig().google.auth.adminDirectoryKey);
    }
    if ((allRequired || types.has(types_1.TYPES.GoogleAuthSubject)) && !skip.has(types_1.TYPES.GoogleAuthSubject)) {
        container.bind(types_1.TYPES.GoogleAuthSubject).toConstantValue(config_1.getConfig().google.auth.subjectEmail);
    }
    if ((allRequired || types.has(types_1.TYPES.GoogleEntityIdPrefix)) && !skip.has(types_1.TYPES.GoogleEntityIdPrefix)) {
        container.bind(types_1.TYPES.GoogleEntityIdPrefix).toConstantValue(config_1.getConfig().google.idPrefix);
    }
    if ((allRequired || types.has(types_1.TYPES.GoogleAdminDirectoryQuotaLimiterConfig)) && !skip.has(types_1.TYPES.GoogleAdminDirectoryQuotaLimiterConfig)) {
        container.bind(types_1.TYPES.GoogleAdminDirectoryQuotaLimiterConfig).toConstantValue(config_1.getConfig().google.quotas.adminDirectoryApi);
    }
    if ((allRequired || types.has(types_1.TYPES.GoogleCalendarQuotaLimiterConfig)) && !skip.has(types_1.TYPES.GoogleCalendarQuotaLimiterConfig)) {
        container.bind(types_1.TYPES.GoogleCalendarQuotaLimiterConfig).toConstantValue(config_1.getConfig().google.quotas.calendarApi);
    }
    // Unchecked
    container.bind(types_1.TYPES.GoogleCalendarConfig).toConstantValue(config_1.getConfig().google.calendar);
    container.bind(types_1.TYPES.GoogleApiCalendar)
        .to(google_api_calendar_1.GoogleApiCalendar);
    container.bind(types_1.TYPES.RoomsService).to(rooms_service_1.RoomsService);
    container.bind(types_1.TYPES.GroupsService).to(groups_service_1.GroupsService);
    container.bind(types_1.TYPES.CalendarService).to(calendar_service_1.CalendarService);
    container.bind(types_1.TYPES.EventsService).to(events_service_1.EventsService);
    container.bind(types_1.TYPES.Config).to(config_service_1.ConfigService);
    boundTypes = types;
    return container;
}
exports.createContainer = createContainer;
let initPromise = null;
function getContainerAsyncInitializer(additionalTypes) {
    if (!container) {
        throw new TypeError('Container is not initialized');
    }
    if (!initPromise) {
        initPromise = getInitPromise();
    }
    const types = new Set(additionalTypes);
    return types.size === 0 ? initPromise : getInitPromise(types);
}
exports.getContainerAsyncInitializer = getContainerAsyncInitializer;
function getInitPromise(types = boundTypes) {
    if (!container || !types) {
        throw new TypeError('Container is not created');
    }
    const promises = [];
    if (types.size === 0) {
        return Promise.resolve([]);
    }
    if (types.size === 0
        || types.has(types_1.TYPES.GoogleAuthAdminDirectory)
        || types.has(google_auth_admin_directory_1.GoogleAuthAdminDirectory)) {
        promises.push(container.get(types_1.TYPES.GoogleAuthAdminDirectory)[object_1.ASYNC_INIT]);
    }
    if (types.size === 0
        || types.has(cached_cist_json_client_service_1.CachedCistJsonClientService)) {
        promises.push(container.get(types_1.TYPES.CistJsonClient)[object_1.ASYNC_INIT]);
    }
    return Promise.all(promises);
}
function getContainer() {
    if (!container) {
        throw new TypeError('Container is not created');
    }
    return container;
}
exports.getContainer = getContainer;
//# sourceMappingURL=container.js.map