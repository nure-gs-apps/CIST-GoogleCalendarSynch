"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const googleapis_1 = require("googleapis");
const inversify_1 = require("inversify");
const types_1 = require("../../di/types");
const constants_1 = require("./constants");
let GoogleCalendarAuth = class GoogleCalendarAuth {
    constructor(subject, keyFilepath) {
        this[types_1.ASYNC_INIT] = googleapis_1.google.auth.getClient({
            scopes: constants_1.calenderAuthScopes.slice(),
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
GoogleCalendarAuth = tslib_1.__decorate([
    inversify_1.injectable(),
    tslib_1.__param(0, inversify_1.inject(types_1.TYPES.GoogleAuthSubject)),
    tslib_1.__param(1, inversify_1.inject(types_1.TYPES.GoogleAuthCalendarKeyFilepath)),
    tslib_1.__metadata("design:paramtypes", [String, String])
], GoogleCalendarAuth);
exports.GoogleCalendarAuth = GoogleCalendarAuth;
//# sourceMappingURL=google-calendar-auth.js.map