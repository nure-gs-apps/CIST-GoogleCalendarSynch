"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const googleapis_1 = require("googleapis");
const inversify_1 = require("inversify");
const types_1 = require("../../di/types");
let GoogleApiAdminDirectory = class GoogleApiAdminDirectory {
    constructor(googleAuth) {
        Object.defineProperty(this, "_googleAuth", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "googleDirectory", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this._googleAuth = googleAuth;
        if (!this._googleAuth.authClient) {
            throw new TypeError('Google auth is not initialized');
        }
        this.googleDirectory = googleapis_1.google.admin({
            version: 'directory_v1',
            auth: this._googleAuth.authClient,
        });
    }
};
GoogleApiAdminDirectory = tslib_1.__decorate([
    inversify_1.injectable(),
    tslib_1.__param(0, inversify_1.inject(types_1.TYPES.GoogleAuth)),
    tslib_1.__metadata("design:paramtypes", [Object])
], GoogleApiAdminDirectory);
exports.GoogleApiAdminDirectory = GoogleApiAdminDirectory;
//# sourceMappingURL=google-api-admin-directory.js.map