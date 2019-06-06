"use strict";
var RoomsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
"use strict";
const inversify_1 = require("inversify");
const types_1 = require("../../di/types");
const google_api_admin_1 = require("./google-api-admin");
let RoomsService = RoomsService_1 = class RoomsService {
    constructor(googleAdmin) {
        this._admin = googleAdmin;
        this._rooms = this._admin.googleAdmin.resources.calendars;
    }
    async ensureRooms(cistResponse) {
        const rooms = await this.loadRooms();
        const promises = [];
        const processedIds = new Set();
        for (const cistBuilding of cistResponse.university.buildings) {
            for (const cistRoom of cistBuilding.auditories) {
                const cistRoomId = this.getRoomId(cistRoom, cistBuilding);
                if (rooms.some(r => r.resourceId === cistRoomId)) {
                    promises.push(this._rooms.update({
                        calendarResourceId: cistRoomId,
                        requestBody: this.cistAuditoryToGoogleRoom(cistRoom, cistRoomId),
                    }));
                }
                else {
                    promises.push(this._rooms.insert({
                        requestBody: this.cistAuditoryToGoogleRoom(cistRoom, cistRoomId),
                    }));
                }
                processedIds.add(cistRoomId);
            }
        }
        for (const googleRoom of rooms) {
            if (!processedIds.has(googleRoom.resourceId)) {
                promises.push(this._rooms.delete({
                    calendarResourceId: googleRoom.resourceId,
                }));
            }
        }
        return Promise.all(promises);
    }
    async loadRooms() {
        let rooms = [];
        let roomsPage = null;
        do {
            roomsPage = await this._rooms.list({
                customer: 'my_customer',
                maxResults: RoomsService_1.ROOMS_PAGE_SIZE,
                nextPage: roomsPage ? roomsPage.data.nextPageToken : null,
            });
            if (roomsPage.data.items) {
                rooms = rooms.concat(
                // Flexible filtering for rooms only. Doesn't count category
                roomsPage.data.items.filter(i => i.resourceType));
            }
        } while (roomsPage.data.nextPageToken);
        return rooms;
    }
    getRoomId(room, building) {
        return `${building.id}_${room.id}`; // using composite id to ensure uniqueness
    }
    cistAuditoryToGoogleRoom(cistRoom, roomId) {
        return {
            resourceId: roomId,
            resourceName: cistRoom.short_name,
            resourceDescription: cistRoom.short_name,
            userVisibleDescription: cistRoom.short_name,
            floorName: cistRoom.floor,
            resourceCategory: 'CONFERENCE_ROOM',
        };
    }
};
RoomsService.ROOMS_PAGE_SIZE = 1000;
RoomsService.CONFERENCE_ROOM = 'CONFERENCE_ROOM';
RoomsService = RoomsService_1 = tslib_1.__decorate([
    inversify_1.injectable(),
    tslib_1.__param(0, inversify_1.inject(types_1.TYPES.GoogleApiAdmin)),
    tslib_1.__metadata("design:paramtypes", [google_api_admin_1.GoogleApiAdmin])
], RoomsService);
exports.RoomsService = RoomsService;
//# sourceMappingURL=rooms.service.js.map