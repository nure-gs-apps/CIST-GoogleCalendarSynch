"use strict";
var RoomsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const inversify_1 = require("inversify");
const iterare_1 = require("iterare");
const _types_1 = require("../../@types");
const tasks_1 = require("../../@types/tasks");
const types_1 = require("../../di/types");
const quota_limiter_service_1 = require("../quota-limiter.service");
const constants_1 = require("./constants");
const errors_1 = require("./errors");
const google_api_admin_directory_1 = require("./google-api-admin-directory");
const google_utils_service_1 = require("./google-utils.service");
let RoomsService = RoomsService_1 = class RoomsService {
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
        this._logger = logger;
        this._directory = googleApiAdminDirectory;
        this._rooms = this._directory.googleAdminDirectory.resources.calendars;
        this._quotaLimiter = quotaLimiter;
        this._insert = this._quotaLimiter.limiter.wrap(this._rooms.insert.bind(this._rooms));
        this._patch = this._quotaLimiter.limiter.wrap(this._rooms.patch.bind(this._rooms));
        this._delete = this._quotaLimiter.limiter.wrap(this._rooms.delete.bind(this._rooms));
        this._list = this._quotaLimiter.limiter.wrap(this._rooms.list.bind(this._rooms));
    }
    /**
     * Doesn't handle errors properly
     */
    async ensureRooms(cistResponse) {
        const rooms = await this.getAllRooms();
        // tslint:disable-next-line:max-line-length
        const promises = [];
        for (const cistBuilding of cistResponse.university.buildings) {
            const buildingId = this._utils.getGoogleBuildingId(cistBuilding);
            for (const cistRoom of cistBuilding.auditories) {
                const cistRoomId = this._utils.getRoomId(cistRoom, cistBuilding);
                promises.push(this.doEnsureRoom(cistRoom, cistBuilding, rooms.find(r => r.resourceId === cistRoomId), buildingId, cistRoomId));
            }
        }
        await Promise.all(promises);
    }
    async createRoomsContext(cistResponse) {
        return {
            cistRoomsMap: toRoomsWithBuildings(cistResponse)
                .map(([a, b]) => _types_1.t(this._utils.getRoomId(a, b), {
                room: a,
                building: b
            }))
                .toMap(),
            googleRoomsMap: iterare_1.default(await this.getAllRooms())
                .filter(b => typeof b.resourceId === 'string')
                .map(b => _types_1.t(b.resourceId, b))
                .toMap()
        };
    }
    createEnsureRoomsTask(cistResponse) {
        return {
            taskType: tasks_1.TaskType.EnsureRooms,
            steps: toRoomsWithBuildings(cistResponse)
                .map(([a, b]) => this._utils.getRoomId(a, b))
                .toArray(),
        };
    }
    async ensureRoom(cistRoomId, context) {
        const cistData = context.cistRoomsMap.get(cistRoomId);
        if (!cistData) {
            throw new errors_1.FatalError(`Room ${cistRoomId} is not found in the context`);
        }
        await this.doEnsureRoom(cistData.room, cistData.building, context.googleRoomsMap.get(cistRoomId), cistRoomId);
    }
    /**
     * Doesn't handle errors properly
     */
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
    /**
     * Doesn't handle errors properly
     */
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
    createDeleteIrrelevantTask(context) {
        return {
            taskType: tasks_1.TaskType.DeleteIrrelevantRooms,
            steps: iterare_1.default(context.googleRoomsMap.keys())
                .filter(googleRoomId => !context.cistRoomsMap.has(googleRoomId))
                .map(id => id)
                .toArray(),
        };
    }
    async deleteRoomById(roomId) {
        return this.doDeleteById(roomId);
    }
    /**
     * Doesn't handle errors properly
     */
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
    async getAllRooms() {
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
    async doEnsureRoom(cistRoom, cistBuilding, googleRoom, cistRoomId = this._utils.getRoomId(cistRoom, cistBuilding), buildingId = this._utils.getGoogleBuildingId(cistBuilding)) {
        if (googleRoom) {
            const roomPatch = this._utils.cistRoomToGoogleRoomPatch(cistRoom, googleRoom, cistBuilding);
            if (roomPatch) {
                return Promise.resolve(this._patch({
                    customer: constants_1.customer,
                    calendarResourceId: cistRoomId,
                    requestBody: roomPatch,
                })).tap(() => this._logger.info(`Patched room ${cistRoom.short_name}, building ${cistBuilding.short_name}`));
            }
            this._logger.info(`No changes in room ${cistRoom.short_name}, building ${cistBuilding.short_name}`);
            return Promise.resolve(null);
        }
        return Promise.resolve(this._insert({
            customer: constants_1.customer,
            requestBody: this._utils.cistRoomToInsertGoogleRoom(cistRoom, cistBuilding, buildingId, cistRoomId),
        })).tap(() => this._logger.info(`Inserted room ${cistRoom.short_name}, building ${cistBuilding.short_name}`));
    }
    doDeleteByIds(rooms, ids, promises = []) {
        for (const googleRoom of rooms) {
            if (googleRoom.resourceId && ids.has(googleRoom.resourceId)) {
                promises.push(this.doDeleteById(googleRoom.resourceId));
            }
        }
        return promises;
    }
    doDeleteById(roomId) {
        return this._delete({
            customer: constants_1.customer,
            calendarResourceId: roomId,
        });
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
    tslib_1.__param(0, inversify_1.inject(types_1.TYPES.GoogleApiAdminDirectory)),
    tslib_1.__param(1, inversify_1.inject(types_1.TYPES.GoogleAdminDirectoryQuotaLimiter)),
    tslib_1.__param(2, inversify_1.inject(types_1.TYPES.GoogleUtils)),
    tslib_1.__param(3, inversify_1.inject(types_1.TYPES.Logger)),
    tslib_1.__metadata("design:paramtypes", [google_api_admin_directory_1.GoogleApiAdminDirectory,
        quota_limiter_service_1.QuotaLimiterService,
        google_utils_service_1.GoogleUtilsService, Object])
], RoomsService);
exports.RoomsService = RoomsService;
function toRoomsWithBuildings(cistResponse) {
    return iterare_1.default(cistResponse.university.buildings)
        .map(b => iterare_1.default(b.auditories).map(a => _types_1.t(a, b)))
        .flatten();
}
//# sourceMappingURL=rooms.service.js.map