"use strict";
var RoomsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const inversify_1 = require("inversify");
const iterare_1 = require("iterare");
const types_1 = require("../../di/types");
const logger_service_1 = require("../logger.service");
const quota_limiter_service_1 = require("../quota-limiter.service");
const constants_1 = require("./constants");
const google_api_directory_1 = require("./google-api-directory");
const google_utils_service_1 = require("./google-utils.service");
let RoomsService = RoomsService_1 = class RoomsService {
    constructor(googleApiDirectory, quotaLimiter, utils) {
        Object.defineProperty(this, "_utils", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
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
        Object.defineProperty(this, "_rooms", {
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
        this._directory = googleApiDirectory;
        this._rooms = this._directory.googleDirectory.resources.calendars;
        this._quotaLimiter = quotaLimiter;
        this._insert = this._quotaLimiter.limiter.wrap(this._rooms.insert.bind(this._rooms));
        this._patch = this._quotaLimiter.limiter.wrap(this._rooms.patch.bind(this._rooms));
        this._delete = this._quotaLimiter.limiter.wrap(this._rooms.delete.bind(this._rooms));
        this._list = this._quotaLimiter.limiter.wrap(this._rooms.list.bind(this._rooms));
    }
    async ensureRooms(cistResponse, preserveNameChanges = false) {
        const rooms = await this.getAllRooms();
        const promises = [];
        const newToOldNames = new Map();
        for (const cistBuilding of cistResponse.university.buildings) {
            const buildingId = this._utils.getGoogleBuildingId(cistBuilding);
            for (const cistRoom of cistBuilding.auditories) {
                const cistRoomId = this._utils.getRoomId(cistRoom, cistBuilding);
                const googleRoom = rooms.find(r => r.resourceId === cistRoomId);
                if (googleRoom) {
                    const roomPatch = cistRoomToGoogleRoomPatch(cistRoom, googleRoom, buildingId);
                    if (roomPatch) {
                        if (newToOldNames && roomPatch.resourceName) {
                            newToOldNames.set(roomPatch.resourceName, 
                            // tslint:disable-next-line:no-non-null-assertion
                            googleRoom.resourceName);
                        }
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
                        requestBody: cistRoomToInsertGoogleRoom(cistRoom, buildingId, cistRoomId),
                    }));
                }
            }
        }
        await Promise.all(promises);
        return newToOldNames;
    }
    async deleteAll() {
        var _a;
        const rooms = await this.getAllRooms();
        const promises = [];
        for (const room of rooms) {
            promises.push(this._delete({
                customer: constants_1.customer,
                calendarResourceId: (_a = room.resourceId) !== null && _a !== void 0 ? _a : undefined,
            }));
        }
        return Promise.all(promises);
    }
    async deleteIrrelevant(cistResponse) {
        const rooms = await this.getAllRooms();
        return Promise.all(this.doDeleteByIds(rooms, iterare_1.default(rooms).filter(r => {
            for (const building of cistResponse.university.buildings) {
                const isRelevant = building.auditories.some(a => this._utils.isSameIdentity(a, building, r));
                if (isRelevant) {
                    return false;
                }
            }
            return true;
            // tslint:disable-next-line:no-non-null-assertion
        }).map(r => r.resourceId).toSet()));
    }
    async deleteRelevant(cistResponse) {
        const rooms = await this.getAllRooms();
        return Promise.all(this.doDeleteByIds(rooms, iterare_1.default(rooms).filter(r => {
            for (const building of cistResponse.university.buildings) {
                const isRelevant = building.auditories.some(a => this._utils.isSameIdentity(a, building, r));
                if (isRelevant) {
                    return true;
                }
            }
            return false;
            // tslint:disable-next-line:no-non-null-assertion
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
        return rooms;
    }
    doDeleteByIds(rooms, ids, promises = []) {
        var _a;
        for (const googleRoom of rooms) {
            // tslint:disable-next-line:no-non-null-assertion
            if (ids.has(googleRoom.resourceId)) {
                promises.push(this._delete({
                    customer: constants_1.customer,
                    calendarResourceId: (_a = googleRoom.resourceId) !== null && _a !== void 0 ? _a : undefined,
                }));
            }
        }
        return promises;
    }
};
Object.defineProperty(RoomsService, "ROOMS_PAGE_SIZE", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: 500
}); // maximum
Object.defineProperty(RoomsService, "CONFERENCE_ROOM", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: 'CONFERENCE_ROOM'
});
RoomsService = RoomsService_1 = tslib_1.__decorate([
    inversify_1.injectable(),
    tslib_1.__param(0, inversify_1.inject(types_1.TYPES.GoogleApiDirectory)),
    tslib_1.__param(1, inversify_1.inject(types_1.TYPES.GoogleDirectoryQuotaLimiter)),
    tslib_1.__param(2, inversify_1.inject(types_1.TYPES.GoogleUtils)),
    tslib_1.__metadata("design:paramtypes", [google_api_directory_1.GoogleApiDirectory,
        quota_limiter_service_1.QuotaLimiterService,
        google_utils_service_1.GoogleUtilsService])
], RoomsService);
exports.RoomsService = RoomsService;
function cistRoomToInsertGoogleRoom(cistRoom, googleBuildingId, roomId) {
    const room = {
        resourceId: roomId,
        buildingId: googleBuildingId,
        resourceName: cistRoom.short_name,
        capacity: 999,
        resourceDescription: cistRoom.short_name,
        userVisibleDescription: cistRoom.short_name,
        floorName: google_utils_service_1.transformFloorname(cistRoom.floor),
        resourceCategory: 'CONFERENCE_ROOM',
    };
    return room;
}
function cistRoomToGoogleRoomPatch(cistRoom, googleRoom, googleBuildingId) {
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
    const floorName = google_utils_service_1.transformFloorname(cistRoom.floor);
    if (floorName !== googleRoom.floorName) {
        roomPatch.floorName = floorName;
        hasChanges = true;
    }
    return hasChanges ? roomPatch : null;
}
//# sourceMappingURL=rooms.service.js.map