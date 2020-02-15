"use strict";
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const inversify_1 = require("inversify");
const googleapis_1 = require("googleapis");
const types_1 = require("../../di/types");
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
            value: _authClient
        });
        this[types_1.ASYNC_INIT] = googleapis_1.google.auth.getClient({
            scopes: scopes.slice(),
            keyFilename: keyFilepath,
            clientOptions: {
                subject,
            },
        });
        this._authClient = null;
        this[types_1.ASYNC_INIT]
            .then(authClient => this._authClient = authClient);
    }
    get authClient() {
        return this._authClient;
    }
};
_a = types_1.ASYNC_INIT;
GoogleAuth = tslib_1.__decorate([
    inversify_1.injectable(),
    tslib_1.__param(0, inversify_1.inject(types_1.TYPES.GoogleAuthSubject)),
    tslib_1.__param(1, inversify_1.inject(types_1.TYPES.GoogleAuthKeyFilepath)),
    tslib_1.__param(2, inversify_1.inject(types_1.TYPES.GoogleAuthScopes)),
    tslib_1.__metadata("design:paramtypes", [String, String, Array])
], GoogleAuth);
exports.GoogleAuth = GoogleAuth;
//# sourceMappingURL=google-auth.js.map