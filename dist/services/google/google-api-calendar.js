"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const googleapis_1 = require("googleapis");
const inversify_1 = require("inversify");
const types_1 = require("../../di/types");
let GoogleApiCalendar = class GoogleApiCalendar {
    constructor(googleAuth) {
        this._googleAuth = googleAuth;
        if (!this._googleAuth.authClient) {
            throw new TypeError('Google auth is not initialized');
        }
        this.googleCalendar = googleapis_1.google.calendar({
            version: 'v3',
            auth: this._googleAuth.authClient,
        });
    }
};
GoogleApiCalendar = tslib_1.__decorate([
    inversify_1.injectable(),
    tslib_1.__param(0, inversify_1.inject(types_1.TYPES.GoogleAuth)),
    tslib_1.__metadata("design:paramtypes", [Object])
], GoogleApiCalendar);
exports.GoogleApiCalendar = GoogleApiCalendar;
//# sourceMappingURL=google-api-calendar.js.map