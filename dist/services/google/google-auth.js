"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const appRootPath = require("app-root-path");
const googleapis_1 = require("googleapis");
const googleapis_2 = require("googleapis/build/src/googleapis");
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
let defaultSubject;
function setDefaultSubject(value) {
    defaultSubject = value;
}
exports.setDefaultSubject = setDefaultSubject;
async function createAuthWithFallback(key, scopes, subject, onError = lodash_1.noop) {
    if (typeof key === 'string' && !path.isAbsolute(key)) {
        let filePath = path.resolve(key);
        try {
            return await createAuth(filePath, scopes, subject);
        }
        catch (error) {
            filePath = appRootPath.resolve(key);
            try {
                return await createAuth(filePath, scopes, subject);
            }
            catch (error) {
                onError(error, filePath);
                return createAuth();
            }
        }
    }
    try {
        return await createAuth(key, scopes, subject);
    }
    catch (error) {
        onError(error);
        return createAuth();
    }
}
exports.createAuthWithFallback = createAuthWithFallback;
function createAuth(key, scopes, subject) {
    if (!key) {
        const options = {
            scopes: defaultScopes
        };
        if (defaultSubject !== undefined) {
            options.clientOptions = {
                subject: defaultSubject
            };
        }
        return googleapis_1.google.auth.getClient(options);
    }
    if (typeof key === 'string') {
        const options = {
            scopes,
            keyFilename: key
        };
        if (subject !== undefined) {
            options.clientOptions = {
                subject,
            };
        }
        return new googleapis_2.AuthPlus(options).getClient();
    }
    const client = googleapis_1.google.auth.fromJSON(key);
    client.scopes = scopes; // as per docs: https://github.com/googleapis/google-auth-library-nodejs/tree/v6.0.0#loading-credentials-from-environment-variables
    if (subject !== undefined) {
        client.subject = subject;
    }
    return Promise.resolve(client);
}
exports.createAuth = createAuth;
//# sourceMappingURL=google-auth.js.map