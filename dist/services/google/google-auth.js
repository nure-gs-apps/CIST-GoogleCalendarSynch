"use strict";
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const inversify_1 = require("inversify");
const googleapis_1 = require("googleapis");
const lodash_1 = require("lodash");
const path = require("path");
const object_1 = require("../../@types/object");
const types_1 = require("../../di/types");
const appRootPath = require("app-root-path");
let GoogleAuth = class GoogleAuth {
    constructor(subject, keyFilepath, scopes) {
        Object.defineProperty(this, _a, {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "_authClient", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this[object_1.ASYNC_INIT] = googleapis_1.google.auth.getClient({
            scopes: scopes.slice(),
            keyFilename: keyFilepath,
            clientOptions: {
                subject,
            },
        });
        this._authClient = null;
        this[object_1.ASYNC_INIT]
            .then(authClient => this._authClient = authClient);
    }
    get authClient() {
        return this._authClient;
    }
};
_a = object_1.ASYNC_INIT;
GoogleAuth = tslib_1.__decorate([
    inversify_1.injectable(),
    tslib_1.__param(0, inversify_1.inject(types_1.TYPES.GoogleAuthSubject)),
    tslib_1.__param(1, inversify_1.inject(types_1.TYPES.GoogleAuthKeyFilepath)),
    tslib_1.__param(2, inversify_1.inject(types_1.TYPES.GoogleAuthScopes)),
    tslib_1.__metadata("design:paramtypes", [String, String, Array])
], GoogleAuth);
exports.GoogleAuth = GoogleAuth;
let defaultScopes = [];
function clearDefaultScopes() {
    defaultScopes = [];
}
exports.clearDefaultScopes = clearDefaultScopes;
function addDefaultScopes(newScopes) {
    defaultScopes = defaultScopes.concat(newScopes);
}
exports.addDefaultScopes = addDefaultScopes;
async function createAuthWithFallback(key, scopes, onError = lodash_1.noop) {
    if (typeof key === 'string' && !path.isAbsolute(key)) {
        let filePath = path.resolve(key);
        try {
            return await createAuth(filePath, scopes);
        }
        catch (error) {
            filePath = appRootPath.resolve(key);
            try {
                return await createAuth(filePath, scopes);
            }
            catch (error) {
                onError(error, filePath);
                return createAuth();
            }
        }
    }
    try {
        return await createAuth(key, scopes);
    }
    catch (error) {
        onError(error);
        return createAuth();
    }
}
exports.createAuthWithFallback = createAuthWithFallback;
function createAuth(key, scopes) {
    if (!key) {
        return googleapis_1.google.auth.getClient({
            scopes: defaultScopes
        });
    }
    if (typeof key === 'string') {
        return new googleapis_1.google.auth.GoogleAuth({
            scopes,
            keyFilename: key,
        }).getClient();
    }
    const client = googleapis_1.google.auth.fromJSON(key);
    client.scopes = scopes; // as per docs: https://github.com/googleapis/google-auth-library-nodejs/tree/v6.0.0#loading-credentials-from-environment-variables
    return Promise.resolve(client);
}
exports.createAuth = createAuth;
//# sourceMappingURL=google-auth.js.map