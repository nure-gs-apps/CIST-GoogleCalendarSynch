"use strict";
var BuildingsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
"use strict";
const inversify_1 = require("inversify");
const iterare_1 = require("iterare");
const types_1 = require("../../di/types");
const common_1 = require("../../utils/common");
const logger_service_1 = require("../logger.service");
const quota_limiter_service_1 = require("../quota-limiter.service");
const constants_1 = require("./constants");
const google_api_directory_1 = require("./google-api-directory");
let BuildingsService = BuildingsService_1 = class BuildingsService {
    constructor(googleApiDirectory, quotaLimiter) {
        this._directory = googleApiDirectory;
        this._buildings = this._directory.googleDirectory.resources.buildings;
        this._quotaLimiter = quotaLimiter;
        this._insert = this._quotaLimiter.limiter.wrap(this._buildings.insert.bind(this._buildings));
        this._patch = this._quotaLimiter.limiter.wrap(this._buildings.patch.bind(this._buildings));
        this._delete = this._quotaLimiter.limiter.wrap(this._buildings.delete.bind(this._buildings));
        this._list = this._quotaLimiter.limiter.wrap(this._buildings.list.bind(this._buildings));
        this._cachedBuildings = null;
        this._cacheLastUpdate = null;
    }
    get cachedBuildings() {
        return this._cachedBuildings;
    }
    get cacheLastUpdate() {
        return this._cacheLastUpdate
            ? new Date(this._cacheLastUpdate.getTime())
            : null;
    }
    async ensureBuildings(cistResponse) {
        const buildings = await this.getAllBuildings();
        const promises = [];
        for (const cistBuilding of cistResponse.university.buildings) {
            const googleBuildingId = getGoogleBuildingId(cistBuilding);
            const googleBuilding = buildings.find(b => isSameIdentity(cistBuilding, b, googleBuildingId));
            if (googleBuilding) {
                const buildingPatch = cistBuildingToGoogleBuildingPatch(cistBuilding, googleBuilding);
                if (buildingPatch) {
                    logger_service_1.logger.debug(`Patching building ${cistBuilding.short_name}`);
                    promises.push(this._patch({
                        customer: constants_1.customer,
                        buildingId: googleBuildingId,
                        requestBody: buildingPatch,
                    }));
                }
            }
            else {
                logger_service_1.logger.debug(`Inserting building ${cistBuilding.short_name}`);
                promises.push(this._insert({
                    customer: constants_1.customer,
                    requestBody: cistBuildingToInsertGoogleBuilding(cistBuilding, googleBuildingId),
                }));
            }
        }
        this.clearCache();
        return Promise.all(promises);
    }
    async deleteAll() {
        const buildings = await this.getAllBuildings();
        const promises = [];
        for (const room of buildings) {
            promises.push(this._delete({
                customer: constants_1.customer,
                buildingId: room.buildingId,
            }));
        }
        this.clearCache();
        return Promise.all(promises);
    }
    async deleteIrrelevant(cistResponse) {
        const buildings = await this.getAllBuildings();
        this.clearCache();
        return Promise.all(this.doDeleteByIds(buildings, iterare_1.iterate(buildings).filter(building => (!cistResponse.university.buildings.some(b => isSameIdentity(b, building)))).map(b => b.buildingId).toSet()));
    }
    async deleteRelevant(cistResponse) {
        const buildings = await this.getAllBuildings();
        this.clearCache();
        return Promise.all(this.doDeleteByIds(buildings, iterare_1.iterate(buildings).filter(building => (cistResponse.university.buildings.some(b => isSameIdentity(b, building)))).map(b => b.buildingId).toSet()));
    }
    async getAllBuildings(cacheResults = false) {
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
        if (cacheResults) {
            this._cachedBuildings = buildings;
            this._cacheLastUpdate = new Date();
        }
        return buildings;
    }
    clearCache() {
        this._cachedBuildings = null;
        this._cacheLastUpdate = null;
    }
    doDeleteByIds(buildings, ids, promises = []) {
        for (const googleBuilding of buildings) {
            if (ids.has(googleBuilding.buildingId)) {
                promises.push(this._delete({
                    customer: constants_1.customer,
                    buildingId: googleBuilding.buildingId,
                }));
            }
        }
        return promises;
    }
};
BuildingsService.BUILDING_PAGE_SIZE = 100;
BuildingsService = BuildingsService_1 = tslib_1.__decorate([
    inversify_1.injectable(),
    tslib_1.__param(0, inversify_1.inject(types_1.TYPES.GoogleApiDirectory)),
    tslib_1.__param(1, inversify_1.inject(types_1.TYPES.GoogleDirectoryQuotaLimiter)),
    tslib_1.__metadata("design:paramtypes", [google_api_directory_1.GoogleApiDirectory,
        quota_limiter_service_1.QuotaLimiterService])
], BuildingsService);
exports.BuildingsService = BuildingsService;
function cistBuildingToInsertGoogleBuilding(cistBuilding, id = getGoogleBuildingId(cistBuilding)) {
    return {
        buildingId: id,
        buildingName: cistBuilding.short_name,
        description: cistBuilding.full_name,
        floorNames: getFloornamesFromBuilding(cistBuilding),
    };
}
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
    const floorNames = getFloornamesFromBuilding(cistBuilding);
    if (!common_1.arrayContentEqual(googleBuilding.floorNames, floorNames)) {
        buildingPatch.floorNames = floorNames;
        hasChanges = true;
    }
    return hasChanges ? buildingPatch : null;
}
// FIXME: maybe move to other place
function getFloornamesFromBuilding(building) {
    return Array.from(iterare_1.iterate(building.auditories)
        .map(r => transformFloorname(r.floor))
        .toSet()
        .values());
}
exports.buildingIdPrefix = 'b';
function getGoogleBuildingId(cistBuilding) {
    return constants_1.prependIdPrefix(`${exports.buildingIdPrefix}.${common_1.toBase64(cistBuilding.id)}`);
}
exports.getGoogleBuildingId = getGoogleBuildingId;
const emptyFloorName = /^\s*$/;
function transformFloorname(floorName) {
    return !emptyFloorName.test(floorName) ? floorName : '_';
}
exports.transformFloorname = transformFloorname;
function isSameIdentity(cistBuilding, googleBuilding, googleBuildingId = getGoogleBuildingId(cistBuilding)) {
    return googleBuilding.buildingId === googleBuildingId;
}
exports.isSameIdentity = isSameIdentity;
//# sourceMappingURL=buildings.service.js.map