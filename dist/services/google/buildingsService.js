"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const inversify_1 = require("inversify");
const google_api_admin_1 = require("./google-api-admin");
let BuildingsService = class BuildingsService {
    constructor(googleApiAdmin) {
        this._admin = googleApiAdmin;
    }
    get _buildings() {
        return this._admin.googleAdmin.resources.buildings;
    }
};
BuildingsService = tslib_1.__decorate([
    inversify_1.injectable(),
    tslib_1.__param(0, inversify_1.inject(google_api_admin_1.GoogleApiAdmin)),
    tslib_1.__metadata("design:paramtypes", [google_api_admin_1.GoogleApiAdmin])
], BuildingsService);
exports.BuildingsService = BuildingsService;
//# sourceMappingURL=buildingsService.js.map