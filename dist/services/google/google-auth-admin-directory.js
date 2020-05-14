"use strict";
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const inversify_1 = require("inversify");
const object_1 = require("../../@types/object");
const types_1 = require("../../di/types");
const constants_1 = require("./constants");
const google_auth_1 = require("./google-auth");
google_auth_1.addDefaultScopes(constants_1.adminDirectoryAuthScopes);
let GoogleAuthAdminDirectory = class GoogleAuthAdminDirectory {
    constructor(logger, key) {
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
        this._authClient = null;
        this[object_1.ASYNC_INIT] = (key ? google_auth_1.createAuthWithFallback(key, constants_1.adminDirectoryAuthScopes.slice(), (error, keyPath) => {
            if (keyPath) {
                logger.warn(l(`Failed to load key from file "${keyPath}" due to error:`), error);
            }
            else {
                logger.warn(l('Error while loading key due to error:'), error);
            }
        }) : google_auth_1.createAuth()).then(c => this._authClient = c);
    }
    get authClient() {
        if (!this._authClient) {
            throw new TypeError(l('is not initialized!'));
        }
        return this._authClient;
    }
};
_a = object_1.ASYNC_INIT;
GoogleAuthAdminDirectory = tslib_1.__decorate([
    inversify_1.injectable(),
    tslib_1.__param(0, inversify_1.inject(types_1.TYPES.Logger)),
    tslib_1.__param(1, inversify_1.inject(types_1.TYPES.GoogleAuthAdminDirectoryKey)),
    tslib_1.__metadata("design:paramtypes", [Object, Object])
], GoogleAuthAdminDirectory);
exports.GoogleAuthAdminDirectory = GoogleAuthAdminDirectory;
function l(message) {
    return `${GoogleAuthAdminDirectory.name} ${message}`;
}
//# sourceMappingURL=google-auth-admin-directory.js.map