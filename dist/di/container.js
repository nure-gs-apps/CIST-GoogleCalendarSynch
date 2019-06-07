"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const config = require("config");
const inversify_1 = require("inversify");
const cist_json_client_service_1 = require("../services/cist-json-client.service");
const buildings_service_1 = require("../services/google/buildings.service");
const google_api_admin_1 = require("../services/google/google-api-admin");
const google_admin_auth_1 = require("../services/google/google-admin-auth");
const rooms_service_1 = require("../services/google/rooms.service");
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
    container = new inversify_1.Container({
        autoBindInjectable: true,
        defaultScope: inversify_1.BindingScopeEnum.Singleton,
    });
    if (containerType === types_1.ContainerType.FULL) {
        container.bind(types_1.TYPES.CistBaseApi).toConstantValue(config.get('cist.baseUrl'));
        container.bind(types_1.TYPES.CistApiKey).toConstantValue(config.get('cist.apiKey'));
        container.bind(types_1.TYPES.GoogleAuthSubject).toConstantValue(config.get('google.auth.subjectEmail'));
        container.bind(types_1.TYPES.GoogleAuthCalendarKeyFilepath).toConstantValue(config.get('google.auth.calendarKeyFilepath'));
        container.bind(types_1.TYPES.GoogleAuthAdminKeyFilepath).toConstantValue(config.get('google.auth.adminKeyFilepath'));
        container.bind(types_1.TYPES.CistJsonClient).to(cist_json_client_service_1.CistJsonClient);
        container.bind(types_1.TYPES.GoogleAdminAuth).to(google_admin_auth_1.GoogleAdminAuth);
        container.bind(types_1.TYPES.GoogleApiAdmin).to(google_api_admin_1.GoogleApiAdmin);
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