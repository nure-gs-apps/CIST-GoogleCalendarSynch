"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const config_1 = require("../config");
const inversify_1 = require("inversify");
const _types_1 = require("../@types");
const config_service_1 = require("../config/config.service");
const cache_utils_service_1 = require("../services/cache-utils.service");
const cist_json_http_client_service_1 = require("../services/cist/cist-json-http-client.service");
const buildings_service_1 = require("../services/google/buildings.service");
const calendar_service_1 = require("../services/google/calendar.service");
const constants_1 = require("../services/google/constants");
const events_service_1 = require("../services/google/events.service");
const google_api_calendar_1 = require("../services/google/google-api-calendar");
const google_auth_1 = require("../services/google/google-auth");
const google_api_directory_1 = require("../services/google/google-api-directory");
const groups_service_1 = require("../services/google/groups.service");
const rooms_service_1 = require("../services/google/rooms.service");
const utils_service_1 = require("../services/google/utils.service");
const quota_limiter_service_1 = require("../services/quota-limiter.service");
const types_1 = require("./types");
let container = null;
let containerType = null;
function hasContainer() {
    return !!container;
}
exports.hasContainer = hasContainer;
function createContainer(options) {
    const { forceNew, type } = Object.assign({
        forceNew: false,
        type: types_1.ContainerType.FULL,
    }, options);
    containerType = type;
    if (!forceNew && container) {
        throw new TypeError('Container is already created');
    }
    const defaultScope = inversify_1.BindingScopeEnum.Singleton;
    container = new inversify_1.Container({
        defaultScope,
        autoBindInjectable: true,
    });
    if (containerType === types_1.ContainerType.FULL) {
        container.bind(types_1.TYPES.CistBaseApi).toConstantValue(config_1.getConfig().cist.baseUrl);
        container.bind(types_1.TYPES.CistApiKey).toConstantValue(config_1.getConfig().cist.apiKey);
        container.bind(types_1.TYPES.GoogleAuthSubject).toConstantValue(config_1.getConfig().google.auth.subjectEmail);
        container.bind(types_1.TYPES.GoogleAuthKeyFilepath)
            .toConstantValue(config_1.getConfig().google.auth.keyFilepath // TODO: clarify configuration
            // tslint:disable-next-line:no-non-null-assertion
            || process.env.GOOGLE_APPLICATION_CREDENTIALS);
        container.bind(types_1.TYPES.GoogleAuthScopes)
            .toConstantValue(constants_1.directoryAuthScopes.concat(constants_1.calenderAuthScopes));
        container.bind(types_1.TYPES.GoogleCalendarConfig).toConstantValue(config_1.getConfig().google.calendar);
        container.bind(types_1.TYPES.CistJsonHttpClient)
            .to(cist_json_http_client_service_1.CistJsonHttpClient);
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
    }
    else if (containerType === types_1.ContainerType.CIST_JSON_ONLY) {
        container.bind(types_1.TYPES.CistBaseApi).toConstantValue(config_1.getConfig().cist.baseUrl);
        container.bind(types_1.TYPES.CistApiKey).toConstantValue(config_1.getConfig().cist.apiKey);
        container.bind(types_1.TYPES.CistJsonHttpClient)
            .to(cist_json_http_client_service_1.CistJsonHttpClient);
    }
    container.bind(types_1.TYPES.GoogleUtils).to(utils_service_1.UtilsService);
    container.bind(types_1.TYPES.Config).to(config_service_1.ConfigService);
    container.bind(types_1.TYPES.CacheUtils).to(cache_utils_service_1.CacheUtilsService);
    container.bind(types_1.TYPES.CacheMaxExpiration).toConstantValue(config_1.getConfig().caching.maxExpiration);
    container.bind(types_1.TYPES.CistCacheConfig)
        .toConstantValue(config_1.getConfig().caching.cist);
    return container;
}
exports.createContainer = createContainer;
function getContainer() {
    if (!container) {
        throw new TypeError('Container is not created');
    }
    return container;
}
exports.getContainer = getContainer;
let initPromise = null;
function getAsyncInitializers() {
    if (!container) {
        throw new TypeError('Container is not initialized');
    }
    if (initPromise) {
        return initPromise;
    }
    const promises = [];
    if (containerType === types_1.ContainerType.FULL) {
        promises.push(container.get(types_1.TYPES.GoogleAuth)[_types_1.ASYNC_INIT]);
    }
    // tslint:disable-next-line:no-non-null-assertion
    initPromise = Promise.all(promises);
    return initPromise;
}
exports.getAsyncInitializers = getAsyncInitializers;
//# sourceMappingURL=container.js.map