"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const inversify_1 = require("inversify");
const iterare_1 = require("iterare");
const _types_1 = require("../../@types");
const types_1 = require("../../di/types");
const google_utils_service_1 = require("./google-utils.service");
const groups_service_1 = require("./groups.service");
const rooms_service_1 = require("./rooms.service");
let EventsContextService = class EventsContextService {
    constructor(roomsService, groupsService, utils) {
        Object.defineProperty(this, "_groupsService", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "_roomsService", {
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
        this._roomsService = roomsService;
        this._groupsService = groupsService;
        this._utils = utils;
    }
    async createGeneralContext() {
        const groups = new _types_1.GuardedMap(iterare_1.iterate(await this._groupsService.getAllGroups())
            .filter(g => typeof g.email === 'string')
            .map(g => _types_1.t(this._utils.getGroupIdFromEmail(g.email), g)));
        const rooms = new _types_1.GuardedMap(iterare_1.iterate(await this._roomsService.getAllRooms())
            .filter(r => typeof r.resourceName === 'string'
            && typeof r.resourceEmail === 'string')
            .map(r => _types_1.t(google_utils_service_1.getGoogleRoomShortName(r), r.resourceEmail)));
        const context = {
            roomEmailsByNames: rooms,
            googleGroups: groups
        };
        return context;
    }
};
EventsContextService = tslib_1.__decorate([
    inversify_1.injectable(),
    tslib_1.__param(0, inversify_1.inject(types_1.TYPES.RoomsService)),
    tslib_1.__param(1, inversify_1.inject(types_1.TYPES.GroupsService)),
    tslib_1.__param(2, inversify_1.inject(types_1.TYPES.GoogleUtils)),
    tslib_1.__metadata("design:paramtypes", [rooms_service_1.RoomsService,
        groups_service_1.GroupsService,
        google_utils_service_1.GoogleUtilsService])
], EventsContextService);
exports.EventsContextService = EventsContextService;
//# sourceMappingURL=events-context.service.js.map