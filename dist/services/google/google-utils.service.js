"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const inversify_1 = require("inversify");
const types_1 = require("../../di/types");
const common_1 = require("../../utils/common");
const translit_1 = require("../../utils/translit");
exports.buildingIdPrefix = 'b';
exports.roomIdPrefix = 'r';
exports.groupEmailPrefix = 'g';
let GoogleUtilsService = class GoogleUtilsService {
    constructor(subject, idPrefix) {
        Object.defineProperty(this, "_idPrefix", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "domainName", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "prependIdPrefix", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.domainName = subject.slice(subject.indexOf('@'), subject.length)
            .toLowerCase();
        if (!idPrefix) {
            this.prependIdPrefix = id => id;
        }
        else {
            this._idPrefix = idPrefix;
            this.prependIdPrefix = id => `${this._idPrefix}.${id}`;
        }
    }
    isSameBuildingIdentity(cistBuilding, googleBuilding) {
        return googleBuilding.buildingId === this.getGoogleBuildingId(cistBuilding);
    }
    isSameIdentity(cistRoom, building, googleRoom) {
        return googleRoom.resourceId === this.getRoomId(cistRoom, building);
    }
    getGoogleBuildingId(cistBuilding) {
        return this.prependIdPrefix(`${exports.buildingIdPrefix}.${common_1.toBase64(cistBuilding.id)}`);
    }
    getRoomId(room, building) {
        return this.prependIdPrefix(`${exports.roomIdPrefix}.${common_1.toBase64(building.id)}.${common_1.toBase64(room.id)}`); // using composite id to ensure uniqueness
    }
    getGroupEmail(cistGroup) {
        const uniqueHash = cistGroup.id.toString();
        const localPartTemplate = [`${exports.groupEmailPrefix}_`, `.${uniqueHash}`];
        // is OK for google email, but causes collisions
        const groupName = translit_1.toTranslit(cistGroup.name, 64 - (localPartTemplate[0].length + localPartTemplate[1].length))
            .replace(/["(),:;<>@[\]\s]|[^\x00-\x7F]/g, '_')
            .toLowerCase();
        return `${localPartTemplate.join(groupName)}@${this.domainName}`;
    }
};
GoogleUtilsService = tslib_1.__decorate([
    inversify_1.injectable(),
    tslib_1.__param(0, inversify_1.inject(types_1.TYPES.GoogleAuthSubject)),
    tslib_1.__param(1, inversify_1.inject(types_1.TYPES.GoogleEntityIdPrefix)),
    tslib_1.__metadata("design:paramtypes", [String, Object])
], GoogleUtilsService);
exports.GoogleUtilsService = GoogleUtilsService;
const emptyFloorName = /^\s*$/;
function transformFloorName(floorName) {
    return !emptyFloorName.test(floorName) ? floorName : '_';
}
exports.transformFloorName = transformFloorName;
function isSameGroupIdentity(cistGroup, googleGroup) {
    // tslint:disable-next-line:no-non-null-assertion
    const emailParts = googleGroup.email.split('@');
    const parts = emailParts[emailParts.length - 2].split('.');
    return cistGroup.id === Number.parseInt(parts[parts.length - 1], 10);
}
exports.isSameGroupIdentity = isSameGroupIdentity;
//# sourceMappingURL=google-utils.service.js.map