"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const inversify_1 = require("inversify");
const cist_json_client_service_1 = require("../services/cist-json-client.service");
const buildingsService_1 = require("../services/google/buildingsService");
const google_api_admin_1 = require("../services/google/google-api-admin");
const google_auth_1 = require("../services/google/google-auth");
const types_1 = require("./types");
let container = null;
function hasContainer() {
    return !!container;
}
exports.hasContainer = hasContainer;
function createContainer(forceNew = false) {
    if (!forceNew && container) {
        throw new TypeError('Container is already created');
    }
    container = new inversify_1.Container({
        autoBindInjectable: true,
        defaultScope: inversify_1.BindingScopeEnum.Singleton,
    });
    container.bind(types_1.TYPES.CistJsonClient).to(cist_json_client_service_1.CistJsonClient);
    container.bind(types_1.TYPES.GoogleAuth).to(google_auth_1.GoogleAuth);
    container.bind(types_1.TYPES.GoogleApiAdmin).to(google_api_admin_1.GoogleApiAdmin);
    container.bind(types_1.TYPES.BuildingsService).to(buildingsService_1.BuildingsService);
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
    promises.push(container.get(types_1.TYPES.GoogleAuth)[types_1.ASYNC_INIT]);
    initPromise = Promise.all(promises);
    return initPromise;
}
exports.getAsyncInitializers = getAsyncInitializers;
//# sourceMappingURL=container.js.map