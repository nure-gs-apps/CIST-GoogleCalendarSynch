"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const appRootPath = require("app-root-path");
const googleapis_1 = require("googleapis");
const lodash_1 = require("lodash");
const path = require("path");
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