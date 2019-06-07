"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const config = require("config");
const inversify_1 = require("inversify");
const cist_json_client_service_1 = require("../services/cist-json-client.service");
const buildings_service_1 = require("../services/google/buildings.service");
const google_directory_auth_1 = require("../services/google/google-directory-auth");
const google_api_directory_1 = require("../services/google/google-api-directory");
const rooms_service_1 = require("../services/google/rooms.service");
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
        container.bind(types_1.TYPES.CistBaseApi).toConstantValue(config.get('cist.baseUrl'));
        container.bind(types_1.TYPES.CistApiKey).toConstantValue(config.get('cist.apiKey'));
        container.bind(types_1.TYPES.GoogleAuthSubject).toConstantValue(config.get('google.auth.subjectEmail'));
        container.bind(types_1.TYPES.GoogleAuthCalendarKeyFilepath).toConstantValue(config.get('google.auth.calendarKeyFilepath') || process.env.GOOGLE_APPLICATION_CREDENTIALS);
        container.bind(types_1.TYPES.GoogleAuthAdminKeyFilepath).toConstantValue(config.get('google.auth.adminKeyFilepath') || process.env.GOOGLE_APPLICATION_CREDENTIALS);
        container.bind(types_1.TYPES.CistJsonClient).to(cist_json_client_service_1.CistJsonClient);
        container.bind(types_1.TYPES.GoogleAdminAuth).to(google_directory_auth_1.GoogleDirectoryAuth);
        container.bind(types_1.TYPES.GoogleDirectoryQuotaLimiter)
            .toDynamicValue(quota_limiter_service_1.getQuotaLimiterFactory(config.get('google.quotas.directoryApi'), defaultScope === inversify_1.BindingScopeEnum.Singleton));
        container.bind(types_1.TYPES.GoogleApiAdmin).to(google_api_directory_1.GoogleApiDirectory);
        container.bind(types_1.TYPES.BuildingsService)
            .to(buildings_service_1.BuildingsService);
        container.bind(types_1.TYPES.RoomsService).to(rooms_service_1.RoomsService);
    }
    else if (containerType === types_1.ContainerType.CIST_JSON_ONLY) {
        container.bind(types_1.TYPES.CistBaseApi).toConstantValue(config.get('cist.baseUrl'));
        container.bind(types_1.TYPES.CistApiKey).toConstantValue(config.get('cist.apiKey'));
        container.bind(types_1.TYPES.CistJsonClient).to(cist_json_client_service_1.CistJsonClient);
    }
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
        promises.push(container.get(types_1.TYPES.GoogleAdminAuth)[types_1.ASYNC_INIT]);
    }
    initPromise = Promise.all(promises);
    return initPromise;
}
exports.getAsyncInitializers = getAsyncInitializers;
//# sourceMappingURL=container.js.map