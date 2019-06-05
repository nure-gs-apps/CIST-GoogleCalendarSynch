"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const inversify_1 = require("inversify");
const googleapis_1 = require("googleapis");
const types_1 = require("../../di/types");
let GoogleAuth = class GoogleAuth {
    constructor() {
        this[types_1.ASYNC_INIT] = googleapis_1.google.auth.getClient();
        this._authClient = null;
        this[types_1.ASYNC_INIT].then(authClient => this._authClient = authClient);
    }
    get authClient() {
        return this._authClient;
    }
};
GoogleAuth = tslib_1.__decorate([
    inversify_1.injectable(),
    tslib_1.__metadata("design:paramtypes", [])
], GoogleAuth);
exports.GoogleAuth = GoogleAuth;
//# sourceMappingURL=google-auth.js.map