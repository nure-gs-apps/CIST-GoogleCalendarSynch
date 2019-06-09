"use strict";
var RoomsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
"use strict";
const inversify_1 = require("inversify");
const iterare_1 = require("iterare");
const types_1 = require("../../di/types");
const common_1 = require("../../utils/common");
const logger_service_1 = require("../logger.service");
const quota_limiter_service_1 = require("../quota-limiter.service");
const buildings_service_1 = require("./buildings.service");
const constants_1 = require("./constants");
const google_api_directory_1 = require("./google-api-directory");
let RoomsService = RoomsService_1 = class RoomsService {
    constructor(googleApiDirectory, quotaLimiter) {
        this._directory = googleApiDirectory;
        this._rooms = this._directory.googleDirectory.resources.calendars;
        this._quotaLimiter = quotaLimiter;
        this._insert = this._quotaLimiter.limiter.wrap(this._rooms.insert.bind(this._rooms));
        this._patch = this._quotaLimiter.limiter.wrap(this._rooms.patch.bind(this._rooms));
        this._delete = this._quotaLimiter.limiter.wrap(this._rooms.delete.bind(this._rooms));
        this._list = this._quotaLimiter.limiter.wrap(this._rooms.list.bind(this._rooms));
        this._cachedRooms = null;
        this._cacheLastUpdate = null;
    }
    get cachedRooms() {
        return this._cachedRooms;
    }
    get cacheLastUpdate() {
        return this._cacheLastUpdate
            ? new Date(this._cacheLastUpdate.getTime())
            : null;
    }
    async ensureRooms(cistResponse) {
        const rooms = await this.getAllRooms();
        const promises = [];
        for (const cistBuilding of cistResponse.university.buildings) {
            const buildingId = buildings_service_1.getGoogleBuildingId(cistBuilding);
            for (const cistRoom of cistBuilding.auditories) {
                const cistRoomId = getRoomId(cistRoom, cistBuilding);
                const googleRoom = rooms.find(r => r.resourceId === cistRoomId);
                if (googleRoom) {
                    const roomPatch = cistAuditoryToGoogleRoomPatch(cistRoom, googleRoom, buildingId);
                    if (roomPatch) {
                        logger_service_1.logger.debug(`Patching room ${cistRoomId} ${cistRoom.short_name}`);
                        promises.push(this._patch({
                            customer: constants_1.customer,
                            calendarResourceId: cistRoomId,
                            requestBody: roomPatch,
                        }));
                    }
                }
                else {
                    logger_service_1.logger.debug(`Inserting room ${cistRoomId} ${cistRoom.short_name}`);
                    promises.push(this._insert({
                        customer: constants_1.customer,
                        requestBody: cistAuditoryToInsertGoogleRoom(cistRoom, buildingId, cistRoomId),
                    }));
                }
            }
        }
        this.clearCache();
        return Promise.all(promises);
    }
    async deleteAll() {
        const rooms = await this.getAllRooms();
        const promises = [];
        for (const room of rooms) {
            promises.push(this._delete({
                customer: constants_1.customer,
                calendarResourceId: room.resourceId,
            }));
        }
        this.clearCache();
        return Promise.all(promises);
    }
    async deleteIrrelevant(cistResponse) {
        const rooms = await this.getAllRooms();
        this.clearCache();
        return Promise.all(this.doDeleteByIds(rooms, iterare_1.default(rooms).filter(r => {
            for (const building of cistResponse.university.buildings) {
                const isRelevant = building.auditories.some(a => r.resourceId === getRoomId(a, building));
                if (isRelevant) {
                    return false;
                }
            }
            return true;
        }).map(r => r.resourceId).toSet()));
    }
    async deleteRelevant(cistResponse) {
        const rooms = await this.getAllRooms();
        this.clearCache();
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
    async getAllRooms(cacheResults = false) {
        let rooms = [];
        let roomsPage = null;
        do {
            roomsPage = await this._list({
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
        if (cacheResults) {
            this._cachedRooms = rooms;
            this._cacheLastUpdate = new Date();
        }
        return rooms;
    }
    clearCache() {
        this._cachedRooms = null;
        this._cacheLastUpdate = null;
    }
    doDeleteByIds(rooms, ids, promises = []) {
        for (const googleRoom of rooms) {
            if (ids.has(googleRoom.resourceId)) {
                promises.push(this._delete({
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
    tslib_1.__param(0, inversify_1.inject(types_1.TYPES.GoogleApiDirectory)),
    tslib_1.__param(1, inversify_1.inject(types_1.TYPES.GoogleDirectoryQuotaLimiter)),
    tslib_1.__metadata("design:paramtypes", [google_api_directory_1.GoogleApiDirectory,
        quota_limiter_service_1.QuotaLimiterService])
], RoomsService);
exports.RoomsService = RoomsService;
function cistAuditoryToInsertGoogleRoom(cistRoom, googleBuildingId, roomId) {
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
function cistAuditoryToGoogleRoomPatch(cistRoom, googleRoom, googleBuildingId) {
    let hasChanges = false;
    const roomPatch = {};
    if (googleBuildingId !== googleRoom.buildingId) {
        roomPatch.buildingId = googleBuildingId;
        hasChanges = true;
    }
    if (cistRoom.short_name !== googleRoom.resourceName) {
        roomPatch.resourceName = cistRoom.short_name;
        hasChanges = true;
    }
    if (cistRoom.short_name !== googleRoom.resourceDescription) {
        roomPatch.resourceDescription = cistRoom.short_name;
        hasChanges = true;
    }
    if (cistRoom.short_name !== googleRoom.userVisibleDescription) {
        roomPatch.userVisibleDescription = cistRoom.short_name;
        hasChanges = true;
    }
    const floorName = buildings_service_1.transformFloorname(cistRoom.floor);
    if (floorName !== googleRoom.floorName) {
        roomPatch.floorName = floorName;
        hasChanges = true;
    }
    return hasChanges ? roomPatch : null;
}
exports.roomIdPrefix = 'r';
function getRoomId(room, building) {
    return constants_1.prependIdPrefix(`${exports.roomIdPrefix}.${common_1.toBase64(building.id)}.${common_1.toBase64(room.id)}`); // using composite id to ensure uniqueness
}
exports.getRoomId = getRoomId;
//# sourceMappingURL=rooms.service.js.map