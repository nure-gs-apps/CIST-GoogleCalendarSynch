"use strict";
var RoomsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
"use strict";
const inversify_1 = require("inversify");
const iterare_1 = require("iterare");
const types_1 = require("../../di/types");
const translit_1 = require("../../utils/translit");
const logger_service_1 = require("../logger.service");
const buildings_service_1 = require("./buildings.service");
const constants_1 = require("./constants");
const google_api_admin_1 = require("./google-api-admin");
let RoomsService = RoomsService_1 = class RoomsService {
    constructor(googleAdmin) {
        this._admin = googleAdmin;
        this._rooms = this._admin.googleAdmin.resources.calendars;
    }
    async ensureRooms(cistResponse) {
        const rooms = await this.getAllRooms();
        const promises = [];
        for (const cistBuilding of cistResponse.university.buildings) {
            const buildingId = buildings_service_1.getGoogleBuildingId(cistBuilding);
            for (const cistRoom of cistBuilding.auditories) {
                const cistRoomId = getRoomId(cistRoom, cistBuilding);
                if (rooms.some(r => r.resourceId === cistRoomId)) {
                    logger_service_1.logger.debug(`Updating room ${cistRoomId}`);
                    promises.push(this._rooms.update({
                        customer: constants_1.customer,
                        calendarResourceId: cistRoomId,
                        requestBody: cistAuditoryToGoogleRoom(cistRoom, buildingId, cistRoomId),
                    }));
                }
                else {
                    logger_service_1.logger.debug(`Inserting room ${cistRoomId}`);
                    promises.push(this._rooms.insert({
                        customer: constants_1.customer,
                        requestBody: cistAuditoryToGoogleRoom(cistRoom, buildingId, cistRoomId),
                    }));
                }
            }
        }
        return Promise.all(promises);
    }
    async deleteAll() {
        const rooms = await this.getAllRooms();
        const promises = [];
        for (const room of rooms) {
            promises.push(this._rooms.delete({
                customer: constants_1.customer,
                calendarResourceId: room.resourceId,
            }));
        }
        return Promise.all(promises);
    }
    async deleteIrrelevant(cistResponse) {
        const rooms = await this.getAllRooms();
        return Promise.all(this.doDeleteByIds(rooms, iterare_1.default(rooms).filter(r => {
            for (const building of cistResponse.university.buildings) {
                const isIrrelevant = !building.auditories.some(a => r.resourceId === getRoomId(a, building));
                if (isIrrelevant) {
                    return true;
                }
            }
            return false;
        }).map(r => r.resourceId).toSet()));
    }
    async deleteRelevant(cistResponse) {
        const rooms = await this.getAllRooms();
        return Promise.all(this.doDeleteByIds(rooms, iterare_1.default(rooms).filter(r => {
            for (const building of cistResponse.university.buildings) {
                const isRelevant = building.auditories.some(a => r.resourceId === getRoomId(a, building));
                if (isRelevant) {
                    return true;
                }
            }
            return false;
        }).map(r => r.resourceId).toSet()));
    }
    async getAllRooms() {
        let rooms = [];
        let roomsPage = null;
        do {
            roomsPage = await this._rooms.list({
                customer: constants_1.customer,
                maxResults: RoomsService_1.ROOMS_PAGE_SIZE,
                nextPage: roomsPage ? roomsPage.data.nextPageToken : null,
            });
            if (roomsPage.data.items) {
                rooms = rooms.concat(
                // Flexible filtering for rooms only. Doesn't count on category
                roomsPage.data.items.filter(i => !i.resourceType));
            }
        } while (roomsPage.data.nextPageToken);
        return rooms;
    }
    doDeleteByIds(rooms, ids, promises = []) {
        for (const googleRoom of rooms) {
            if (ids.has(googleRoom.resourceId)) {
                promises.push(this._rooms.delete({
                    customer: constants_1.customer,
                    calendarResourceId: googleRoom.resourceId,
                }));
            }
        }
        return promises;
    }
};
RoomsService.ROOMS_PAGE_SIZE = 500; // maximum
RoomsService.CONFERENCE_ROOM = 'CONFERENCE_ROOM';
RoomsService = RoomsService_1 = tslib_1.__decorate([
    inversify_1.injectable(),
    tslib_1.__param(0, inversify_1.inject(types_1.TYPES.GoogleApiAdmin)),
    tslib_1.__metadata("design:paramtypes", [google_api_admin_1.GoogleApiAdmin])
], RoomsService);
exports.RoomsService = RoomsService;
function cistAuditoryToGoogleRoom(cistRoom, googleBuildingId, roomId) {
    const room = {
        resourceId: roomId,
        buildingId: googleBuildingId,
        resourceName: cistRoom.short_name,
        capacity: 999,
        resourceDescription: cistRoom.short_name,
        userVisibleDescription: cistRoom.short_name,
        floorName: buildings_service_1.transformFloorname(cistRoom.floor),
        resourceCategory: 'CONFERENCE_ROOM',
    };
    return room;
}
function getRoomId(room, building) {
    return `${constants_1.idPrefix}.${translit_1.toTranslit(building.id)}.${translit_1.toTranslit(room.id)}`; // using composite id to ensure uniqueness
}
exports.getRoomId = getRoomId;
//# sourceMappingURL=rooms.service.js.map