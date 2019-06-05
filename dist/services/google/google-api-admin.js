"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const googleapis_1 = require("googleapis");
const inversify_1 = require("inversify");
const google_auth_1 = require("./google-auth");
let GoogleApiAdmin = class GoogleApiAdmin {
    constructor(googleAuth) {
        this._googleAuth = googleAuth;
        if (!this._googleAuth.authClient) {
            throw new TypeError('Google auth is not initialized');
        }
        this.googleAdmin = googleapis_1.google.admin({
            auth: this._googleAuth.authClient,
        });
    }
};
GoogleApiAdmin = tslib_1.__decorate([
    inversify_1.injectable(),
    tslib_1.__param(0, inversify_1.inject(google_auth_1.GoogleAuth)),
    tslib_1.__metadata("design:paramtypes", [google_auth_1.GoogleAuth])
], GoogleApiAdmin);
exports.GoogleApiAdmin = GoogleApiAdmin;
//# sourceMappingURL=google-api-admin.js.map