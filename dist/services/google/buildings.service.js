"use strict";
var BuildingsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
"use strict";
const inversify_1 = require("inversify");
const iterare_1 = require("iterare");
const types_1 = require("../../di/types");
const constants_1 = require("./constants");
const google_api_admin_1 = require("./google-api-admin");
let BuildingsService = BuildingsService_1 = class BuildingsService {
    constructor(googleApiAdmin) {
        this._admin = googleApiAdmin;
        this._buildings = this._admin.googleAdmin.resources.buildings;
    }
    async ensureBuildings(cistResponse) {
        const buildings = await this.loadBuildings();
        const promises = [];
        const processedIds = new Set();
        for (const cistBuilding of cistResponse.university.buildings) {
            const googleBuildingId = getGoogleBuildingId(cistBuilding);
            if (buildings.some(b => b.buildingId === googleBuildingId)) {
                promises.push(this._buildings.update({
                    customer: constants_1.customer,
                    buildingId: googleBuildingId,
                    requestBody: this.cistBuildingToGoogleBuilding(cistBuilding, googleBuildingId),
                }));
            }
            else {
                promises.push(this._buildings.insert({
                    customer: constants_1.customer,
                    requestBody: this.cistBuildingToGoogleBuilding(cistBuilding, googleBuildingId),
                }));
            }
            processedIds.add(googleBuildingId);
        }
        // for (const googleBuilding of buildings) {
        //   if (!processedIds.has(googleBuilding.buildingId!)) {
        //     promises.push(
        //       this._buildings.delete({
        //         customer,
        //         buildingId: googleBuilding.buildingId,
        //       }),
        //     );
        //   }
        // }
        return Promise.all(promises);
    }
    async loadBuildings() {
        let buildings = [];
        let buildingsPage = null;
        do {
            buildingsPage = await this._buildings.list({
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
    cistBuildingToGoogleBuilding(cistBuilding, id = getGoogleBuildingId(cistBuilding)) {
        return {
            buildingId: id,
            buildingName: cistBuilding.short_name,
            description: cistBuilding.full_name,
            floorNames: Array.from(iterare_1.iterate(cistBuilding.auditories)
                .map(r => transformFloorname(r.floor))
                .toSet()
                .values()),
        };
    }
};
BuildingsService.BUILDING_PAGE_SIZE = 100;
BuildingsService = BuildingsService_1 = tslib_1.__decorate([
    inversify_1.injectable(),
    tslib_1.__param(0, inversify_1.inject(types_1.TYPES.GoogleApiAdmin)),
    tslib_1.__metadata("design:paramtypes", [google_api_admin_1.GoogleApiAdmin])
], BuildingsService);
exports.BuildingsService = BuildingsService;
function getGoogleBuildingId(cistBuilding) {
    return `${constants_1.idPrefix}.${cistBuilding.id}`;
}
exports.getGoogleBuildingId = getGoogleBuildingId;
function transformFloorname(floorName) {
    return floorName ? floorName : '_';
}
exports.transformFloorname = transformFloorname;
//# sourceMappingURL=buildings.service.js.map