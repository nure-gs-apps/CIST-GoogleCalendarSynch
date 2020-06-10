"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const inversify_1 = require("inversify");
const types_1 = require("../../di/types");
const common_1 = require("../../utils/common");
const translit_1 = require("../../utils/translit");
const errors_1 = require("./errors");
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
        Object.defineProperty(this, "removeIdPrefix", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.domainName = subject.slice(subject.indexOf('@'), subject.length)
            .toLowerCase();
        if (!idPrefix) {
            this.prependIdPrefix = id => id;
            this.removeIdPrefix = id => id;
        }
        else {
            this._idPrefix = idPrefix;
            this.prependIdPrefix = id => `${this._idPrefix}.${id}`;
            this.removeIdPrefix = id => id.slice(id.indexOf('.') + 1);
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
    getCistBuildingId(googleBuildingId) {
        const id = this.removeIdPrefix(googleBuildingId);
        return common_1.fromBase64(id.slice(id.indexOf('.') + 1));
    }
    getRoomId(room, building) {
        return this.prependIdPrefix(`${exports.roomIdPrefix}.${common_1.toBase64(building.id)}.${common_1.toBase64(room.id)}`); // using composite id to ensure uniqueness
    }
    getGroupEmail(cistGroup) {
        const uniqueHash = cistGroup.id.toString();
        const localPartTemplate = [`${exports.groupEmailPrefix}_`, `_${uniqueHash}`];
        // is OK for google email, but causes collisions
        const groupName = translit_1.toTranslit(cistGroup.name, 64 - (localPartTemplate[0].length + localPartTemplate[1].length))
            .replace(/["(),:;<>@[\]\s]|[^\x00-\x7F]/g, '_')
            .toLowerCase();
        return `${localPartTemplate.join(groupName)}@${this.domainName}`;
    }
    // // There is another way of making a unique hash
    // // is Unique but too long and unneeded
    // const uniqueHash = toBase64(cistGroup.name)
    //   .split('')
    //   .map(c => v.isAlpha(c) && v.isUpperCase(c) ? `_${c.toLowerCase()}` : c)
    //   .join('');
    getGroupIdFromEmail(email) {
        const atSignIndex = email.indexOf('@');
        if (atSignIndex < 0) {
            throwInvalidGroupEmailError(email);
        }
        const id = Number.parseFloat(email.slice(email.lastIndexOf('_', atSignIndex) + 1, atSignIndex));
        if (Number.isNaN(id)) {
            throwInvalidGroupEmailError(email);
        }
        return id;
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
function throwInvalidGroupEmailError(email) {
    throw new errors_1.FatalError(`Invalid group email ${email}`);
}
//# sourceMappingURL=google-utils.service.js.map