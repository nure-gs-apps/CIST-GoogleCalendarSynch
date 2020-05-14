"use strict";
var BuildingsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const inversify_1 = require("inversify");
const iterare_1 = require("iterare");
const types_1 = require("../../di/types");
const cist_1 = require("../../utils/cist");
const common_1 = require("../../utils/common");
const quota_limiter_service_1 = require("../quota-limiter.service");
const constants_1 = require("./constants");
const google_api_admin_directory_1 = require("./google-api-admin-directory");
const google_utils_service_1 = require("./google-utils.service");
let BuildingsService = BuildingsService_1 = class BuildingsService {
    constructor(googleApiAdminDirectory, quotaLimiter, utils, logger) {
        Object.defineProperty(this, "_directory", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "_quotaLimiter", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "_utils", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "_logger", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "_buildings", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "_insert", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "_patch", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "_delete", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "_list", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this._utils = utils;
        this._logger = logger;
        this._directory = googleApiAdminDirectory;
        this._buildings = this._directory.googleAdminDirectory.resources.buildings;
        this._quotaLimiter = quotaLimiter;
        this._insert = this._quotaLimiter.limiter.wrap(this._buildings.insert.bind(this._buildings));
        this._patch = this._quotaLimiter.limiter.wrap(this._buildings.patch.bind(this._buildings));
        this._delete = this._quotaLimiter.limiter.wrap(this._buildings.delete.bind(this._buildings));
        this._list = this._quotaLimiter.limiter.wrap(this._buildings.list.bind(this._buildings));
    }
    async ensureBuildings(cistResponse) {
        const buildings = await this.getAllBuildings();
        const promises = [];
        for (const cistBuilding of cistResponse.university.buildings) {
            const googleBuildingId = this._utils.getGoogleBuildingId(cistBuilding);
            const googleBuilding = buildings.find(b => b.buildingId === googleBuildingId);
            if (googleBuilding) {
                const buildingPatch = cistBuildingToGoogleBuildingPatch(cistBuilding, googleBuilding);
                if (buildingPatch) {
                    this._logger.info(`Patching building ${cistBuilding.short_name}`);
                    promises.push(this._patch({
                        customer: constants_1.customer,
                        buildingId: googleBuildingId,
                        requestBody: buildingPatch,
                    }));
                }
            }
            else {
                this._logger.info(`Inserting building ${cistBuilding.short_name}`);
                promises.push(this._insert({
                    customer: constants_1.customer,
                    requestBody: this.cistBuildingToInsertGoogleBuilding(cistBuilding, googleBuildingId),
                }));
            }
        }
        return Promise.all(promises);
    }
    async deleteAll() {
        var _a;
        const buildings = await this.getAllBuildings();
        const promises = [];
        for (const room of buildings) {
            promises.push(this._delete({
                customer: constants_1.customer,
                buildingId: (_a = room.buildingId) !== null && _a !== void 0 ? _a : undefined,
            }));
        }
        return Promise.all(promises);
    }
    async deleteIrrelevant(cistResponse) {
        const buildings = await this.getAllBuildings();
        return Promise.all(this.doDeleteByIds(buildings, iterare_1.iterate(buildings).filter(building => (!cistResponse.university.buildings.some(b => this._utils.isSameBuildingIdentity(b, building))
        // tslint:disable-next-line:no-non-null-assertion
        )).map(b => b.buildingId).toSet()));
    }
    async deleteRelevant(cistResponse) {
        const buildings = await this.getAllBuildings();
        return Promise.all(this.doDeleteByIds(buildings, iterare_1.iterate(buildings).filter(building => (cistResponse.university.buildings.some(b => this._utils.isSameBuildingIdentity(b, building))
        // tslint:disable-next-line:no-non-null-assertion
        )).map(b => b.buildingId).toSet()));
    }
    async getAllBuildings() {
        let buildings = [];
        let buildingsPage = null;
        do {
            buildingsPage = await this._list({
                customer: constants_1.customer,
                maxResults: BuildingsService_1.BUILDING_PAGE_SIZE,
                nextPage: buildingsPage ? buildingsPage.data.nextPageToken : null,
            });
            if (buildingsPage.data.buildings) {
                buildings = buildings.concat(buildingsPage.data.buildings);
            }
        } while (buildingsPage.data.nextPageToken);
        return buildings;
    }
    doDeleteByIds(buildings, ids, promises = []) {
        var _a;
        for (const googleBuilding of buildings) {
            // tslint:disable-next-line:no-non-null-assertion
            if (ids.has(googleBuilding.buildingId)) {
                promises.push(this._delete({
                    customer: constants_1.customer,
                    buildingId: (_a = googleBuilding.buildingId) !== null && _a !== void 0 ? _a : undefined,
                }));
            }
        }
        return promises;
    }
    cistBuildingToInsertGoogleBuilding(cistBuilding, id = this._utils.getGoogleBuildingId(cistBuilding)) {
        return {
            buildingId: id,
            buildingName: cistBuilding.short_name,
            description: cistBuilding.full_name,
            floorNames: cist_1.getFloornamesFromBuilding(cistBuilding),
        };
    }
};
Object.defineProperty(BuildingsService, "BUILDING_PAGE_SIZE", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: 100
});
BuildingsService = BuildingsService_1 = tslib_1.__decorate([
    inversify_1.injectable(),
    tslib_1.__param(0, inversify_1.inject(types_1.TYPES.GoogleApiAdminDirectory)),
    tslib_1.__param(1, inversify_1.inject(types_1.TYPES.GoogleAdminDirectoryQuotaLimiter)),
    tslib_1.__param(2, inversify_1.inject(types_1.TYPES.GoogleUtils)),
    tslib_1.__param(3, inversify_1.inject(types_1.TYPES.Logger)),
    tslib_1.__metadata("design:paramtypes", [google_api_admin_directory_1.GoogleApiAdminDirectory,
        quota_limiter_service_1.QuotaLimiterService,
        google_utils_service_1.GoogleUtilsService, Object])
], BuildingsService);
exports.BuildingsService = BuildingsService;
function cistBuildingToGoogleBuildingPatch(cistBuilding, googleBuilding) {
    let hasChanges = false;
    const buildingPatch = {};
    if (cistBuilding.short_name !== googleBuilding.buildingName) {
        buildingPatch.buildingName = cistBuilding.short_name;
        hasChanges = true;
    }
    if (cistBuilding.full_name !== googleBuilding.description) {
        buildingPatch.description = cistBuilding.full_name;
        hasChanges = true;
    }
    const floorNames = cist_1.getFloornamesFromBuilding(cistBuilding);
    // tslint:disable-next-line:no-non-null-assertion
    if (!common_1.arrayContentEqual(googleBuilding.floorNames, floorNames)) {
        buildingPatch.floorNames = floorNames;
        hasChanges = true;
    }
    return hasChanges ? buildingPatch : null;
}
//# sourceMappingURL=buildings.service.js.map