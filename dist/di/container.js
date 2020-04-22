"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const types_1 = require("./types");
const config_1 = require("../config");
const inversify_1 = require("inversify");
const _types_1 = require("../@types");
const config_service_1 = require("../config/config.service");
const cache_utils_service_1 = require("../services/cache-utils.service");
const cached_cist_json_client_service_1 = require("../services/cist/cached-cist-json-client.service");
const cist_json_http_client_service_1 = require("../services/cist/cist-json-http-client.service");
const cist_json_http_utils_service_1 = require("../services/cist/cist-json-http-utils.service");
const buildings_service_1 = require("../services/google/buildings.service");
const calendar_service_1 = require("../services/google/calendar.service");
const constants_1 = require("../services/google/constants");
const events_service_1 = require("../services/google/events.service");
const google_api_calendar_1 = require("../services/google/google-api-calendar");
const google_auth_1 = require("../services/google/google-auth");
const google_api_directory_1 = require("../services/google/google-api-directory");
const groups_service_1 = require("../services/google/groups.service");
const rooms_service_1 = require("../services/google/rooms.service");
const google_utils_service_1 = require("../services/google/google-utils.service");
const quota_limiter_service_1 = require("../services/quota-limiter.service");
let container = null;
function hasContainer() {
    return !!container;
}
exports.hasContainer = hasContainer;
function createContainer(options) {
    const { forceNew, types: typesIterable } = Object.assign({
        forceNew: false,
        types: [],
    }, options);
    if (!forceNew && container) {
        throw new TypeError('Container is already created');
    }
    const types = new Set(typesIterable);
    const allRequired = types.size === 0;
    const defaultScope = inversify_1.BindingScopeEnum.Singleton;
    container = new inversify_1.Container({
        defaultScope,
        autoBindInjectable: true,
    });
    if (allRequired || types.has(cached_cist_json_client_service_1.CachedCistJsonClientService)) {
        types.add(types_1.TYPES.CacheUtils);
        types.add(types_1.TYPES.CistCacheConfig);
    }
    if (allRequired
        || types.has(types_1.TYPES.CacheUtils)
        || types.has(cache_utils_service_1.CacheUtilsService)) {
        container.bind(types_1.TYPES.CacheUtils).to(cache_utils_service_1.CacheUtilsService);
        types.add(types_1.TYPES.CacheMaxExpiration);
    }
    if (allRequired
        || types.has(types_1.TYPES.CistJsonHttpClient)
        || types.has(cist_json_http_client_service_1.CistJsonHttpClient)) {
        container.bind(types_1.TYPES.CistJsonHttpClient)
            .to(cist_json_http_client_service_1.CistJsonHttpClient);
    }
    if (allRequired
        || types.has(types_1.TYPES.CistJsonHttpUtils)
        || types.has(cist_json_http_utils_service_1.CistJsonHttpUtilsService)) {
        container.bind(types_1.TYPES.CistJsonHttpUtils)
            .to(cist_json_http_utils_service_1.CistJsonHttpUtilsService);
    }
    if (allRequired
        || types.has(types_1.TYPES.CistCacheConfig)) {
        container.bind(types_1.TYPES.CistCacheConfig)
            .toConstantValue(config_1.getConfig().caching.cist);
    }
    if (allRequired
        || types.has(types_1.TYPES.CacheMaxExpiration)) {
        container.bind(types_1.TYPES.CacheMaxExpiration)
            .toConstantValue(config_1.getConfig().caching.maxExpiration);
    }
    if (allRequired
        || types.has(types_1.TYPES.CistApiKey)) {
        container.bind(types_1.TYPES.CistApiKey).toConstantValue(config_1.getConfig().cist.apiKey);
    }
    if (allRequired
        || types.has(types_1.TYPES.CistBaseApiUrl)) {
        container.bind(types_1.TYPES.CistBaseApiUrl).toConstantValue(config_1.getConfig().cist.baseUrl);
    }
    container.bind(types_1.TYPES.GoogleAuthSubject).toConstantValue(config_1.getConfig().google.auth.subjectEmail);
    container.bind(types_1.TYPES.GoogleAuthKeyFilepath)
        .toConstantValue(config_1.getConfig().google.auth.keyFilepath // TODO: clarify configuration
        // tslint:disable-next-line:no-non-null-assertion
        || process.env.GOOGLE_APPLICATION_CREDENTIALS);
    container.bind(types_1.TYPES.GoogleAuthScopes)
        .toConstantValue(constants_1.directoryAuthScopes.concat(constants_1.calenderAuthScopes));
    container.bind(types_1.TYPES.GoogleCalendarConfig).toConstantValue(config_1.getConfig().google.calendar);
    container.bind(types_1.TYPES.GoogleAuth)
        .to(google_auth_1.GoogleAuth);
    container.bind(types_1.TYPES.GoogleDirectoryQuotaLimiter)
        .toDynamicValue(quota_limiter_service_1.getQuotaLimiterFactory(config_1.getConfig().google.quotas.directoryApi, defaultScope === inversify_1.BindingScopeEnum.Singleton));
    container.bind(types_1.TYPES.GoogleCalendarQuotaLimiter)
        .toDynamicValue(quota_limiter_service_1.getQuotaLimiterFactory(config_1.getConfig().google.quotas.calendarApi, defaultScope === inversify_1.BindingScopeEnum.Singleton));
    container.bind(types_1.TYPES.GoogleApiDirectory)
        .to(google_api_directory_1.GoogleApiDirectory);
    container.bind(types_1.TYPES.GoogleApiCalendar)
        .to(google_api_calendar_1.GoogleApiCalendar);
    container.bind(types_1.TYPES.BuildingsService)
        .to(buildings_service_1.BuildingsService);
    container.bind(types_1.TYPES.RoomsService).to(rooms_service_1.RoomsService);
    container.bind(types_1.TYPES.GroupsService).to(groups_service_1.GroupsService);
    container.bind(types_1.TYPES.CalendarService).to(calendar_service_1.CalendarService);
    container.bind(types_1.TYPES.EventsService).to(events_service_1.EventsService);
    container.bind(types_1.TYPES.GoogleUtils).to(google_utils_service_1.GoogleUtilsService);
    container.bind(types_1.TYPES.Config).to(config_service_1.ConfigService);
    setInitPromise(types);
    return container;
}
exports.createContainer = createContainer;
function setInitPromise(types) {
    if (!container) {
        throw new TypeError('Container is not created');
    }
    const promises = [];
    if (types.size === 0
        || types.has(types_1.TYPES.GoogleAuth)
        || types.has(google_auth_1.GoogleAuth)) {
        promises.push(container.get(types_1.TYPES.GoogleAuth)[_types_1.ASYNC_INIT]);
    }
    if (types.size === 0 || types.has(cached_cist_json_client_service_1.CachedCistJsonClientService)) {
        promises.push(container.get(types_1.TYPES.CistJsonClient)[_types_1.ASYNC_INIT]);
    }
    initPromise = Promise.all(promises);
}
function getContainer() {
    if (!container) {
        throw new TypeError('Container is not created');
    }
    return container;
}
exports.getContainer = getContainer;
let initPromise = null;
function getAsyncInitializer() {
    if (!container || !initPromise) {
        throw new TypeError('Container is not initialized');
    }
    return initPromise;
}
exports.getAsyncInitializer = getAsyncInitializer;
//# sourceMappingURL=container.js.map