"use strict";
var BuildingsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const inversify_1 = require("inversify");
const iterare_1 = require("iterare");
const _types_1 = require("../../@types");
const tasks_1 = require("../../@types/tasks");
const types_1 = require("../../di/types");
const cist_1 = require("../../utils/cist");
const common_1 = require("../../utils/common");
const quota_limiter_service_1 = require("../quota-limiter.service");
const constants_1 = require("./constants");
const errors_1 = require("./errors");
const google_api_admin_directory_1 = require("./google-api-admin-directory");
const google_utils_service_1 = require("./google-utils.service");
const lodash_1 = require("lodash");
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
    /**
     * Doesn't handle errors properly
     */
    async ensureBuildings(cistResponse) {
        const buildings = await this.getAllBuildings();
        const promises = [];
        for (const cistBuilding of cistResponse.university.buildings) {
            const googleBuildingId = this._utils.getGoogleBuildingId(cistBuilding);
            promises.push(this.doEnsureBuilding(cistBuilding, buildings.find(b => b.buildingId === googleBuildingId), googleBuildingId));
        }
        return Promise.all(promises);
    }
    async createBuildingsContext(cistResponse) {
        return {
            cistBuildingsMap: iterare_1.iterate(cistResponse.university.buildings)
                .map(b => _types_1.t(b.id, b))
                .toMap(),
            googleBuildingsMap: iterare_1.iterate(await this.getAllBuildings())
                .filter(b => typeof b.buildingId === 'string')
                .map(b => _types_1.t(b.buildingId, b))
                .toMap(),
        };
    }
    createEnsureBuildingsTask(cistResponse) {
        return {
            taskType: tasks_1.TaskType.EnsureBuildings,
            steps: cistResponse.university.buildings.map(b => b.id),
        };
    }
    async ensureBuilding(cistBuildingId, context) {
        const cistBuilding = context.cistBuildingsMap.get(cistBuildingId);
        if (!cistBuilding) {
            throw new errors_1.FatalError(`Building ${cistBuildingId} is not found in the context`);
        }
        const googleBuildingId = this._utils.getGoogleBuildingId(cistBuilding);
        await this.doEnsureBuilding(cistBuilding, context.googleBuildingsMap.get(googleBuildingId), googleBuildingId);
    }
    /**
     * Doesn't handle errors properly
     */
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
    /**
     * Doesn't handle errors properly
     */
    async deleteIrrelevant(cistResponse) {
        const buildings = await this.getAllBuildings();
        return Promise.all(this.doDeleteByIds(buildings, this.getIrrelevantBuildingGoogleIds(buildings, cistResponse).toSet()));
    }
    createDeleteIrrelevantTask(context) {
        return {
            taskType: tasks_1.TaskType.DeleteIrrelevantBuildings,
            steps: iterare_1.iterate(context.googleBuildingsMap.keys())
                .filter(googleBuildingId => !context.cistBuildingsMap.has(this._utils.getCistBuildingId(googleBuildingId)))
                .map(id => id)
                .toArray(),
        };
    }
    async deleteBuildingById(buildingId) {
        return this.doDeleteById(buildingId);
    }
    /**
     * Doesn't handle errors properly
     */
    async deleteRelevant(cistResponse) {
        const buildings = await this.getAllBuildings();
        return Promise.all(this.doDeleteByIds(buildings, iterare_1.iterate(buildings).filter(building => (cistResponse.university.buildings.some(b => this._utils.isSameBuildingIdentity(b, building))))
            .filter(b => typeof b.buildingId === 'string')
            .map(b => b.buildingId)
            .toSet()));
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
    async doEnsureBuilding(cistBuilding, googleBuilding, googleBuildingId) {
        if (googleBuilding) {
            const buildingPatch = cistBuildingToGoogleBuildingPatch(cistBuilding, googleBuilding);
            if (buildingPatch) {
                let floorNames = buildingPatch.floorNames;
                if (floorNames
                    && googleBuilding.floorNames
                    && floorNames.every(f => { var _a; return (_a = googleBuilding.floorNames) === null || _a === void 0 ? void 0 : _a.includes(f); })) {
                    delete buildingPatch.floorNames;
                }
                if (lodash_1.isEmpty(buildingPatch)) {
                    return Promise.resolve(null);
                }
                const updatedBuilding = await this.patch(googleBuildingId, buildingPatch);
                if (floorNames && (!updatedBuilding.data.floorNames
                    || updatedBuilding.data.floorNames.length < floorNames.length
                    || !floorNames.every(f => { var _a; return (_a = updatedBuilding.data.floorNames) === null || _a === void 0 ? void 0 : _a.includes(f); }))) {
                    if (updatedBuilding.data.floorNames) {
                        floorNames = iterare_1.iterate(floorNames)
                            .concat(iterare_1.iterate(updatedBuilding.data.floorNames) // FIXME: add only floors with rooms
                            .filter(f => !(floorNames === null || floorNames === void 0 ? void 0 : floorNames.includes(f)))).toArray();
                    }
                    return this.patch(googleBuildingId, { floorNames }).tap(() => {
                        this._logger.info(`Patched building ${cistBuilding.short_name} with relevant and irrelevant floor names`);
                    });
                }
                this._logger.info(`Patched building ${cistBuilding.short_name}`);
            }
            return Promise.resolve(null);
        }
        return this._insert({
            customer: constants_1.customer,
            requestBody: this.cistBuildingToInsertGoogleBuilding(cistBuilding, googleBuildingId),
        }).tap(() => this._logger.info(`Inserted building ${cistBuilding.short_name}`));
    }
    doDeleteByIds(buildings, ids, promises = []) {
        for (const googleBuilding of buildings) {
            if (googleBuilding.buildingId && ids.has(googleBuilding.buildingId)) {
                promises.push(this.doDeleteById(googleBuilding.buildingId));
            }
        }
        return promises;
    }
    doDeleteById(buildingId) {
        return this._delete({
            customer: constants_1.customer,
            buildingId,
        });
    }
    cistBuildingToInsertGoogleBuilding(cistBuilding, id = this._utils.getGoogleBuildingId(cistBuilding)) {
        return {
            buildingId: id,
            buildingName: cistBuilding.short_name,
            description: cistBuilding.full_name,
            floorNames: cist_1.getFloornamesFromBuilding(cistBuilding),
        };
    }
    getIrrelevantBuildingGoogleIds(googleBuildings, cistResponse) {
        return iterare_1.iterate(googleBuildings).filter(building => (!cistResponse.university.buildings.some(b => this._utils.isSameBuildingIdentity(b, building))))
            .filter(b => typeof b.buildingId === 'string')
            .map(b => b.buildingId);
    }
    patch(id, patch) {
        return this._patch({
            customer: // TODO: handle no update for floors
            constants_1.customer,
            buildingId: id,
            requestBody: patch,
        });
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
    if (googleBuilding.floorNames && !common_1.arrayContentEqual(googleBuilding.floorNames, floorNames)) {
        buildingPatch.floorNames = floorNames;
        hasChanges = true;
    }
    return hasChanges ? buildingPatch : null;
}
//# sourceMappingURL=buildings.service.js.map