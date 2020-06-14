"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const inversify_1 = require("inversify");
const object_1 = require("../@types/object");
const tasks_1 = require("../@types/tasks");
const config_1 = require("../config");
const config_service_1 = require("../config/config.service");
const cache_utils_service_1 = require("../services/caching/cache-utils.service");
const cached_cist_json_client_service_1 = require("../services/cist/cached-cist-json-client.service");
const cist_json_http_client_service_1 = require("../services/cist/cist-json-http-client.service");
const cist_json_http_parser_service_1 = require("../services/cist/cist-json-http-parser.service");
const buildings_service_1 = require("../services/google/buildings.service");
const calendar_service_1 = require("../services/google/calendar.service");
const event_context_service_1 = require("../services/google/event-context.service");
const di_1 = require("../services/google/events-context-storage/di");
const file_1 = require("../services/google/events-context-storage/file");
const events_service_1 = require("../services/google/events.service");
const google_api_admin_directory_1 = require("../services/google/google-api-admin-directory");
const google_api_calendar_1 = require("../services/google/google-api-calendar");
const google_auth_admin_directory_1 = require("../services/google/google-auth-admin-directory");
const google_auth_calendar_1 = require("../services/google/google-auth-calendar");
const google_utils_service_1 = require("../services/google/google-utils.service");
const groups_service_1 = require("../services/google/groups.service");
const rooms_service_1 = require("../services/google/rooms.service");
const logger_service_1 = require("../services/logger.service");
const quota_limiter_service_1 = require("../services/quota-limiter.service");
const di_2 = require("../tasks/progress/di");
const file_2 = require("../tasks/progress/file");
const task_step_executor_1 = require("../tasks/task-step-executor");
const common_1 = require("../utils/common");
const types_1 = require("./types");
const defaultScope = inversify_1.BindingScopeEnum.Singleton;
let container = null;
let boundTypes = null;
let initPromise = null;
let disposeCallbacks = null;
let disposing = null;
function hasContainer() {
    return !!container;
}
exports.hasContainer = hasContainer;
function createContainer(options) {
    const fullOptions = Object.assign({
        forceNew: false,
    }, options);
    if (!fullOptions.forceNew && container) {
        throw new TypeError('Container is already created');
    }
    container = new inversify_1.Container({
        defaultScope,
        autoBindInjectable: true,
    });
    addTypesToContainer(options);
    disposeCallbacks = [];
    return container;
}
exports.createContainer = createContainer;
function addTypesToContainer(options) {
    if (!container) {
        throw new TypeError('Container is not initialized');
    }
    const { types: typesIterable, skip: skipIterable } = Object.assign({
        forceNew: false,
        skip: [],
        types: [],
    }, options);
    const skip = new Set(skipIterable);
    const types = new Set(typesIterable);
    const allRequired = types.size === 0;
    if ((allRequired
        || types.has(types_1.TYPES.TaskStepExecutor)
        || types.has(task_step_executor_1.TaskStepExecutor)) && !skip.has(task_step_executor_1.TaskStepExecutor) && !skip.has(types_1.TYPES.TaskStepExecutor)) {
        container.bind(types_1.TYPES.TaskStepExecutor)
            .to(task_step_executor_1.TaskStepExecutor)
            .onActivation((context, injectable) => addDisposable(context, injectable));
        types.add(types_1.TYPES.Container);
        types.add(types_1.TYPES.Logger);
    }
    if ((allRequired
        || types.has(types_1.TYPES.TaskProgressBackend)) && !skip.has(types_1.TYPES.TaskProgressBackend)) {
        container.bind(types_1.TYPES.TaskProgressBackend)
            .toDynamicValue(di_2.getTaskProgressBackend);
        types.add(types_1.TYPES.TaskProgressBackendType);
    }
    if ((allRequired
        || types.has(types_1.TYPES.TaskProgressBackendType)) && !skip.has(types_1.TYPES.TaskProgressBackendType)) {
        container.bind(types_1.TYPES.TaskProgressBackendType)
            .toConstantValue(config_1.getConfig().tasks.progress.backend);
        types.add(di_2.getTaskProgressBackendSymbol(config_1.getConfig().tasks.progress.backend));
    }
    if ((allRequired
        || types.has(types_1.TYPES.TaskProgressFileBackend)) && !skip.has(types_1.TYPES.TaskProgressFileBackend)) {
        container.bind(types_1.TYPES.TaskProgressFileBackend)
            .to(file_2.TaskProgressFileBackend);
        types.add(types_1.TYPES.TaskProgressFileBackendFileName);
    }
    if ((allRequired || types.has(cached_cist_json_client_service_1.CachedCistJsonClientService)) && !skip.has(cached_cist_json_client_service_1.CachedCistJsonClientService)) {
        container.bind(cached_cist_json_client_service_1.CachedCistJsonClientService)
            .to(cached_cist_json_client_service_1.CachedCistJsonClientService)
            .onActivation(addDisposable);
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
        || types.has(types_1.TYPES.GoogleEventContextService)
        || types.has(event_context_service_1.EventContextService))
        && !skip.has(event_context_service_1.EventContextService)
        && !skip.has(types_1.TYPES.GoogleEventContextService)) {
        container.bind(types_1.TYPES.GoogleEventContextService)
            .to(event_context_service_1.EventContextService);
        types.add(types_1.TYPES.RoomsService);
        types.add(types_1.TYPES.GroupsService);
        types.add(types_1.TYPES.GoogleUtils);
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
        || types.has(types_1.TYPES.EventsService)
        || types.has(events_service_1.EventsService))
        && !skip.has(events_service_1.EventsService)
        && !skip.has(types_1.TYPES.EventsService)) {
        container.bind(types_1.TYPES.EventsService)
            .to(events_service_1.EventsService);
        types.add(types_1.TYPES.GoogleApiCalendar);
        types.add(types_1.TYPES.GoogleCalendarQuotaLimiterConfig);
        types.add(types_1.TYPES.GoogleUtils);
        types.add(types_1.TYPES.Logger);
        types.add(types_1.TYPES.GoogleCalendarTimeZone);
    }
    if ((allRequired
        || types.has(types_1.TYPES.GoogleEventContextService)) && !skip.has(types_1.TYPES.GoogleEventContextService)) {
        container.bind(types_1.TYPES.GoogleEventContextService)
            .toDynamicValue(di_1.getEventsTaskContextStorage);
        types.add(types_1.TYPES.GoogleCalendarEventsTaskContextStorageType);
    }
    if ((allRequired
        || types.has(types_1.TYPES.GoogleCalendarEventsTaskContextStorageType)) && !skip.has(types_1.TYPES.GoogleCalendarEventsTaskContextStorageType)) {
        const type = config_1.getConfig().google.calendar.eventsTaskContextStorage.backend;
        container.bind(types_1.TYPES.GoogleCalendarEventsTaskContextStorageType)
            .toConstantValue(type);
        types.add(di_1.getEventsTaskContextStorageSymbol(type));
    }
    if ((allRequired
        || types.has(types_1.TYPES.GoogleCalendarEventsFileTaskContextStorage)) && !skip.has(types_1.TYPES.GoogleCalendarEventsFileTaskContextStorage)) {
        container.bind(types_1.TYPES.GoogleCalendarEventsFileTaskContextStorage).to(file_1.FileEventsTaskContextStorage);
        types.add(types_1.TYPES.GoogleCalendarEventsTaskContextStorageFileName);
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
        || types.has(types_1.TYPES.GoogleApiCalendar)
        || types.has(google_api_calendar_1.GoogleApiCalendar))
        && !skip.has(google_api_calendar_1.GoogleApiCalendar)
        && !skip.has(types_1.TYPES.GoogleApiCalendar)) {
        container.bind(types_1.TYPES.GoogleApiCalendar)
            .to(google_api_calendar_1.GoogleApiCalendar);
        types.add(types_1.TYPES.GoogleAuthCalendar);
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
    if ((allRequired
        || types.has(types_1.TYPES.GoogleAuthCalendar)
        || types.has(google_auth_calendar_1.GoogleAuthCalendar))
        && !skip.has(google_auth_calendar_1.GoogleAuthCalendar)
        && !skip.has(types_1.TYPES.GoogleAuthCalendar)) {
        container.bind(types_1.TYPES.GoogleAuthCalendar)
            .to(google_auth_calendar_1.GoogleAuthCalendar);
        types.add(types_1.TYPES.Logger);
        types.add(types_1.TYPES.GoogleAuthCalendarKey);
    }
    if ((allRequired || types.has(types_1.TYPES.GoogleAdminDirectoryQuotaLimiter)) && !skip.has(types_1.TYPES.GoogleAdminDirectoryQuotaLimiter)) {
        container.bind(types_1.TYPES.GoogleAdminDirectoryQuotaLimiter)
            .toDynamicValue(quota_limiter_service_1.getQuotaLimiterFactory(types_1.TYPES.GoogleAdminDirectoryQuotaLimiterConfig, defaultScope === inversify_1.BindingScopeEnum.Singleton));
        types.add(types_1.TYPES.GoogleAdminDirectoryQuotaLimiterConfig);
    }
    if ((allRequired || types.has(types_1.TYPES.GoogleCalendarQuotaLimiter)) && !skip.has(types_1.TYPES.GoogleCalendarQuotaLimiter)) {
        container.bind(types_1.TYPES.GoogleCalendarQuotaLimiter)
            .toDynamicValue(quota_limiter_service_1.getQuotaLimiterFactory(types_1.TYPES.GoogleCalendarQuotaLimiterConfig, defaultScope === inversify_1.BindingScopeEnum.Singleton))
            .onActivation(addDisposable);
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
        types.add(types_1.TYPES.GoogleGroupEmailPrefix);
        types.add(types_1.TYPES.CistBaseApiUrl);
        types.add(types_1.TYPES.GoogleCalendarTimeZone);
        types.add(types_1.TYPES.NureAddress);
    }
    if ((allRequired || types.has(types_1.TYPES.Container)) && !skip.has(types_1.TYPES.Container)) {
        container.bind(types_1.TYPES.Container).toConstantValue(container);
    }
    if ((allRequired || types.has(types_1.TYPES.Config)) && !skip.has(types_1.TYPES.Config)) {
        container.bind(types_1.TYPES.Config).to(config_service_1.ConfigService);
    }
    if ((allRequired || types.has(types_1.TYPES.Logger)) && !skip.has(types_1.TYPES.Logger)) {
        container.bind(types_1.TYPES.Logger).toConstantValue(logger_service_1.logger);
    }
    // Constants
    if ((allRequired
        || types.has(types_1.TYPES.TaskProgressFileBackendFileName)) && !skip.has(types_1.TYPES.TaskProgressFileBackendFileName)) {
        container.bind(types_1.TYPES.TaskProgressFileBackendFileName)
            .toConstantValue(common_1.PathUtils.getPath(config_1.getConfig().tasks.progress.backendConfigs[tasks_1.TaskProgressBackend.File]));
    }
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
    if ((allRequired || types.has(types_1.TYPES.GoogleAuthCalendarKey)) && !skip.has(types_1.TYPES.GoogleAuthCalendarKey)) {
        container.bind(types_1.TYPES.GoogleAuthCalendarKey)
            .toConstantValue(config_1.getConfig().google.auth.calendarKey);
    }
    if ((allRequired || types.has(types_1.TYPES.GoogleAuthSubject)) && !skip.has(types_1.TYPES.GoogleAuthSubject)) {
        container.bind(types_1.TYPES.GoogleAuthSubject).toConstantValue(config_1.getConfig().google.auth.adminSubjectEmail);
    }
    if ((allRequired || types.has(types_1.TYPES.GoogleEntityIdPrefix)) && !skip.has(types_1.TYPES.GoogleEntityIdPrefix)) {
        container.bind(types_1.TYPES.GoogleEntityIdPrefix).toConstantValue(config_1.getConfig().google.idPrefix);
    }
    if ((allRequired || types.has(types_1.TYPES.GoogleGroupEmailPrefix)) && !skip.has(types_1.TYPES.GoogleGroupEmailPrefix)) {
        container.bind(types_1.TYPES.GoogleGroupEmailPrefix).toConstantValue(config_1.getConfig().google.groupEmailPrefix);
    }
    if ((allRequired
        || types.has(types_1.TYPES.GoogleCalendarEventsTaskContextStorageFileName)) && !skip.has(types_1.TYPES.GoogleCalendarEventsTaskContextStorageFileName)) {
        container.bind(types_1.TYPES.GoogleCalendarEventsTaskContextStorageFileName)
            .toConstantValue(common_1.PathUtils.getPath(config_1.getConfig().google.calendar
            .eventsTaskContextStorage.backendConfigs[tasks_1.TaskProgressBackend.File]));
    }
    if ((allRequired || types.has(types_1.TYPES.GoogleCalendarTimeZone)) && !skip.has(types_1.TYPES.GoogleCalendarTimeZone)) {
        container.bind(types_1.TYPES.GoogleCalendarTimeZone).toConstantValue(config_1.getConfig().google.calendar.timeZone);
    }
    if ((allRequired || types.has(types_1.TYPES.NureAddress)) && !skip.has(types_1.TYPES.NureAddress)) {
        container.bind(types_1.TYPES.NureAddress)
            .toConstantValue(config_1.getConfig().nureAddress);
    }
    if ((allRequired || types.has(types_1.TYPES.GoogleAdminDirectoryQuotaLimiterConfig)) && !skip.has(types_1.TYPES.GoogleAdminDirectoryQuotaLimiterConfig)) {
        container.bind(types_1.TYPES.GoogleAdminDirectoryQuotaLimiterConfig).toConstantValue(config_1.getConfig().google.quotas.adminDirectoryApi);
    }
    if ((allRequired || types.has(types_1.TYPES.GoogleCalendarQuotaLimiterConfig)) && !skip.has(types_1.TYPES.GoogleCalendarQuotaLimiterConfig)) {
        container.bind(types_1.TYPES.GoogleCalendarQuotaLimiterConfig).toConstantValue(config_1.getConfig().google.quotas.calendarApi);
    }
    // Unchecked
    container.bind(types_1.TYPES.CalendarService).to(calendar_service_1.CalendarService);
    if (boundTypes) {
        for (const type of types) {
            boundTypes.add(type);
        }
    }
    else {
        boundTypes = types;
    }
    if (initPromise) {
        initPromise = initPromise.then(() => getInitPromise(types));
    }
}
exports.addTypesToContainer = addTypesToContainer;
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
function isContainerDisposing() {
    return !!disposing;
}
exports.isContainerDisposing = isContainerDisposing;
async function disposeContainer() {
    if (!container || !disposeCallbacks) {
        throw new TypeError('Container is not initialized');
    }
    if (disposing) {
        return disposing;
    }
    disposing = Promise.resolve();
    for (const dispose of disposeCallbacks) {
        disposing.then(dispose);
    }
    await disposing;
    container.unload();
    container.unbindAll();
    boundTypes = null;
    initPromise = null;
    disposeCallbacks = null;
    container = null;
    disposing = null;
}
exports.disposeContainer = disposeContainer;
function getContainer() {
    if (!container) {
        throw new TypeError('Container is not created');
    }
    return container;
}
exports.getContainer = getContainer;
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
function addDisposable(context, injectable) {
    if (disposeCallbacks) {
        disposeCallbacks.unshift(() => injectable.dispose());
    }
    return injectable;
}
//# sourceMappingURL=container.js.map