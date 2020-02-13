"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const googleapis_1 = require("googleapis");
const inversify_1 = require("inversify");
const types_1 = require("../../di/types");
let GoogleApiDirectory = class GoogleApiDirectory {
    constructor(googleAuth) {
        Object.defineProperty(this, "_googleAuth", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: _googleAuth
        });
        Object.defineProperty(this, "googleDirectory", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: googleDirectory
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
GoogleApiDirectory = tslib_1.__decorate([
    inversify_1.injectable(),
    tslib_1.__param(0, inversify_1.inject(types_1.TYPES.GoogleAuth)),
    tslib_1.__metadata("design:paramtypes", [Object])
], GoogleApiDirectory);
exports.GoogleApiDirectory = GoogleApiDirectory;
//# sourceMappingURL=google-api-directory.js.map