"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const lodash_1 = require("lodash");
const base32_1 = require("@januswel/base32");
const inversify_1 = require("inversify");
const iterare_1 = require("iterare");
const types_1 = require("../../di/types");
const common_1 = require("../../utils/common");
const translit_1 = require("../../utils/translit");
const cist_1 = require("../../@types/cist");
const errors_1 = require("./errors");
const moment = require("moment");
exports.buildingIdPrefix = 'b';
exports.roomIdPrefix = 'r';
let GoogleUtilsService = class GoogleUtilsService {
    constructor(subject, idPrefix, groupEmailPrefix, cistBaseUrl, calendarTimeZone, nureAddress) {
        Object.defineProperty(this, "_idPrefix", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "_groupEmailPrefix", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "cistBaseUrl", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "calendarTimezone", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "nureAddress", {
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
        Object.defineProperty(this, "prependGroupEmailPrefix", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "eventColorToId", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.cistBaseUrl = cistBaseUrl;
        this.calendarTimezone = calendarTimeZone;
        this.nureAddress = nureAddress;
        this.domainName = subject.slice(subject.indexOf('@') + 1, subject.length)
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
        if (!groupEmailPrefix) {
            this.prependGroupEmailPrefix = email => email;
        }
        else {
            this._groupEmailPrefix = groupEmailPrefix;
            this.prependGroupEmailPrefix = email => `${this._groupEmailPrefix}_${email}`;
        }
        this.eventColorToId = new Map();
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
        const localPartTemplate = [this.prependGroupEmailPrefix(''), `_${uniqueHash}`];
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
    cistRoomToGoogleRoomPatch(cistRoom, googleRoom, cistBuilding, googleBuildingId = this.getGoogleBuildingId(cistBuilding)) {
        let hasChanges = false;
        const roomPatch = {};
        if (googleBuildingId !== googleRoom.buildingId) {
            roomPatch.buildingId = googleBuildingId;
            hasChanges = true;
        }
        if (cistRoom.short_name !== getGoogleRoomShortName(googleRoom)) {
            roomPatch.resourceName = cistRoom.short_name;
            hasChanges = true;
        }
        const description = getResourceDescription(cistBuilding, cistRoom);
        if (description !== googleRoom.resourceDescription) {
            roomPatch.resourceDescription = description;
            hasChanges = true;
        }
        const userVisibleDescription = getUserVisibleDescription(cistBuilding, cistRoom);
        if (userVisibleDescription !== googleRoom.userVisibleDescription) {
            roomPatch.userVisibleDescription = userVisibleDescription;
            hasChanges = true;
        }
        const floorName = transformFloorName(cistRoom.floor);
        if (floorName !== googleRoom.floorName) {
            roomPatch.floorName = floorName;
            hasChanges = true;
        }
        return hasChanges ? roomPatch : null;
    }
    cistRoomToInsertGoogleRoom(cistRoom, cistBuilding, googleBuildingId = this.getGoogleBuildingId(cistBuilding), roomId = this.getRoomId(cistRoom, cistBuilding)) {
        const room = {
            resourceId: roomId,
            buildingId: googleBuildingId,
            resourceName: cistRoom.short_name,
            capacity: 999,
            resourceDescription: getResourceDescription(cistBuilding, cistRoom),
            userVisibleDescription: getUserVisibleDescription(cistBuilding, cistRoom),
            floorName: transformFloorName(cistRoom.floor),
            resourceCategory: 'CONFERENCE_ROOM',
        };
        return room;
    }
    cistEventToGoogleEvent(cistEvent, context, cistEventHash = hashCistEvent(cistEvent)) {
        if (!this.calendarTimezone) {
            throw new TypeError('Calendar config is required');
        }
        const type = context.types.get(cistEvent.type);
        const subject = context.subjects.get(cistEvent.subject_id);
        const title = `${subject.brief} ${cistEvent.auditory} ${type.short_name}`;
        const event = {
            anyoneCanAddSelf: false,
            attendeesOmitted: false,
            attendees: this.createEventAttendees(cistEvent, context),
            description: this.createEventDescription(cistEvent, context, subject, type),
            extendedProperties: {
                shared: getEventSharedExtendedProperties(cistEvent, context, subject)
            },
            gadget: {
                title,
                type: cistEvent.type.toString(),
            },
            guestsCanInviteOthers: false,
            guestsCanModify: false,
            guestsCanSeeOtherGuests: true,
            id: eventHashToEventId(cistEventHash),
            reminders: {
                useDefault: true,
            },
            source: {
                title: 'NURE CIST'
            },
            start: {
                dateTime: moment.unix(cistEvent.start_time)
                    .tz(this.calendarTimezone)
                    .toISOString(true),
            },
            end: {
                dateTime: moment.unix(cistEvent.end_time)
                    .tz(this.calendarTimezone)
                    .toISOString(true)
            },
            endTimeUnspecified: false,
            status: 'confirmed',
            summary: getEventSummary(title, cistEvent, context.googleGroups),
            transparency: 'opaque',
            visibility: 'public',
        };
        const colorId = this.getGoogleEventColorId(cistEvent.type);
        if (colorId) {
            event.colorId = colorId;
        }
        if (this.nureAddress) {
            event.location = this.nureAddress;
        }
        if (this.cistBaseUrl && event.source) {
            event.source.url = this.cistBaseUrl;
        }
        return event;
    }
    cistEventToGoogleEventPatch(event, cistEvent, context, cistEventHash = hashCistEvent(cistEvent)) {
        var _a;
        if (!this.calendarTimezone) {
            throw new TypeError('Calendar config is required');
        }
        let hasChanges = false;
        const eventPatch = {};
        const attendees = this.createEventAttendees(cistEvent, context);
        if (!lodash_1.isEqual(event.attendees, attendees)) {
            eventPatch.attendees = attendees;
            hasChanges = true;
        }
        const type = context.types.get(cistEvent.type);
        const subject = context.subjects.get(cistEvent.subject_id);
        const description = this.createEventDescription(cistEvent, context, subject, type);
        if (description !== event.description) {
            eventPatch.description = description;
            hasChanges = true;
        }
        if (!((_a = event.extendedProperties) === null || _a === void 0 ? void 0 : _a.shared)) {
            eventPatch.extendedProperties = {
                shared: getEventSharedExtendedProperties(cistEvent, context, subject)
            };
        }
        else if (common_1.isObjectLike(event.extendedProperties.shared)) {
            const patch = getEventSharedExtendedPropertiesPatch(cistEvent, event.extendedProperties.shared, context, subject);
            if (patch) {
                eventPatch.extendedProperties = {
                    shared: patch
                };
            }
        }
        const gadgetType = cistEvent.type.toString();
        const title = `${subject.brief} ${cistEvent.auditory} ${type.short_name}`;
        if (!event.gadget) {
            eventPatch.gadget = {
                title,
                type: gadgetType,
            };
            hasChanges = true;
        }
        else {
            const gadget = {};
            let gadgetChanged = false;
            if (title !== event.gadget.title) {
                gadget.title = title;
                gadgetChanged = true;
            }
            if (gadgetType !== event.gadget.type) {
                gadget.type = gadgetType;
                gadgetChanged = true;
            }
            if (gadgetChanged) {
                eventPatch.gadget = gadget;
                hasChanges = true;
            }
        }
        const id = eventHashToEventId(cistEventHash);
        if (id !== event.id) {
            eventPatch.id = id;
            hasChanges = true;
        }
        // FIXME: add start & end check
        const summary = getEventSummary(title, cistEvent, context.googleGroups);
        if (summary !== event.summary) {
            eventPatch.summary = summary;
            hasChanges = true;
        }
        const colorId = this.getGoogleEventColorId(cistEvent.type);
        if (colorId !== event.colorId) {
            eventPatch.colorId = colorId;
            hasChanges = true;
        }
        if (this.nureAddress !== event.location) {
            eventPatch.location = this.nureAddress;
            hasChanges = true;
        }
        return hasChanges ? eventPatch : null;
    }
    createEventAttendees(cistEvent, context) {
        const attendees = [
            {
                email: context.roomEmailsByNames.get(cistEvent.auditory),
                optional: false,
                resource: true,
                responseStatus: 'accepted',
            }
        ];
        // TODO: add teachers
        for (const groupId of cistEvent.groups) {
            attendees.push({
                email: context.googleGroups.get(groupId).email,
                optional: false,
                resource: false,
                responseStatus: 'accepted',
            });
        }
        return attendees;
    }
    createEventDescription(cistEvent, context, subject = context.subjects.get(cistEvent.subject_id), type = context.types.get(cistEvent.type)) {
        return `${subject.title} (${subject.brief}), ${type.full_name} (${type.short_name}), ${cistEvent.auditory} \n${iterare_1.iterate(cistEvent.groups).map(g => context.googleGroups.get(g).name)
            .join(', ')} \n${iterare_1.iterate(cistEvent.teachers).map(t => context.teachers.get(t))
            .map(t => `${t.full_name} (${t.short_name})`).join(', ')} \nlesson #${cistEvent.number_pair}`;
    }
    getGoogleEventColorId(eventType) {
        var _a, _b;
        return (_a = this.eventColorToId.get(getGoogleEventColor(eventType))) !== null && _a !== void 0 ? _a : (_b = iterare_1.iterate(this.eventColorToId.entries()).find(([c, id]) => {
            const first = c[0].toLowerCase();
            const second = c[1].toLowerCase();
            return first === c[2].toLowerCase() && first === c[4].toLowerCase()
                && second === c[3].toLowerCase() && second === c[5].toLowerCase();
        })) === null || _b === void 0 ? void 0 : _b[1];
    }
};
GoogleUtilsService = tslib_1.__decorate([
    inversify_1.injectable(),
    tslib_1.__param(0, inversify_1.inject(types_1.TYPES.GoogleAuthSubject)),
    tslib_1.__param(1, inversify_1.inject(types_1.TYPES.GoogleEntityIdPrefix)),
    tslib_1.__param(2, inversify_1.inject(types_1.TYPES.GoogleGroupEmailPrefix)),
    tslib_1.__param(3, inversify_1.inject(types_1.TYPES.CistBaseApiUrl)), tslib_1.__param(3, inversify_1.optional()),
    tslib_1.__param(4, inversify_1.inject(types_1.TYPES.GoogleCalendarTimeZone)), tslib_1.__param(4, inversify_1.optional()),
    tslib_1.__param(5, inversify_1.inject(types_1.TYPES.NureAddress)), tslib_1.__param(5, inversify_1.optional()),
    tslib_1.__metadata("design:paramtypes", [String, Object, Object, Object, Object, Object])
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
function getEventSharedExtendedProperties(cistEvent, context, subject = context.subjects.get(cistEvent.subject_id)) {
    const object = {
        subjectId: getEventSubjectId(cistEvent),
        subject: getEventSubject(subject),
        type: getEventType(cistEvent),
        typeString: getEventTypeString(cistEvent),
        teacherIds: getEventTeacherIds(cistEvent),
        teachers: getEventTeachers(cistEvent, context.teachers),
        groupIds: getEventGroupIds(cistEvent),
        groups: getEventGroups(cistEvent, context.googleGroups),
        classNumber: getEventClassNumber(cistEvent),
        roomShortName: getEventRoomShortName(cistEvent),
    };
    return object;
}
exports.getEventSharedExtendedProperties = getEventSharedExtendedProperties;
function getEventSharedExtendedPropertiesPatch(cistEvent, 
// tslint:disable-next-line:max-line-length
eventSharedExtendedProperties, context, subject = context.subjects.get(cistEvent.subject_id)) {
    const props = eventSharedExtendedProperties;
    let hasChanges = false;
    const patch = {};
    const subjectId = getEventSubjectId(cistEvent);
    if (subjectId !== props.subjectId) {
        patch.subjectId = subjectId;
        hasChanges = true;
    }
    const subjectProp = getEventSubject(subject);
    if (subjectProp !== props.subject) {
        patch.subject = subjectProp;
        hasChanges = true;
    }
    const type = getEventType(cistEvent);
    if (type !== props.type) {
        patch.type = props.type;
        hasChanges = true;
    }
    const typeString = getEventTypeString(cistEvent);
    if (typeString !== props.type) {
        patch.typeString = typeString;
        hasChanges = true;
    }
    const teacherIds = getEventTeacherIds(cistEvent);
    if (teacherIds !== props.teacherIds) {
        patch.teacherIds = teacherIds;
        hasChanges = true;
    }
    const teachers = getEventTeachers(cistEvent, context.teachers);
    if (teachers !== props.teachers) {
        patch.teachers = teachers;
        hasChanges = true;
    }
    const groupIds = getEventGroupIds(cistEvent);
    if (groupIds !== props.groupIds) {
        patch.groupIds = groupIds;
        hasChanges = true;
    }
    const groups = getEventGroups(cistEvent, context.googleGroups);
    if (groups !== props.groups) {
        patch.groups = groups;
        hasChanges = true;
    }
    const classNumber = getEventClassNumber(cistEvent);
    if (classNumber !== props.classNumber) {
        patch.classNumber = classNumber;
        hasChanges = true;
    }
    const roomShortNames = getEventRoomShortName(cistEvent);
    if (roomShortNames !== props.roomShortName) {
        patch.roomShortName = roomShortNames;
        hasChanges = true;
    }
    return hasChanges ? patch : null;
}
exports.getEventSharedExtendedPropertiesPatch = getEventSharedExtendedPropertiesPatch;
function getEventSubjectId(cistEvent) {
    return cistEvent.subject_id.toString();
}
exports.getEventSubjectId = getEventSubjectId;
function getEventSubject(subject) {
    return JSON.stringify(subject);
}
exports.getEventSubject = getEventSubject;
function getEventType(cistEvent) {
    return cistEvent.type.toString();
}
exports.getEventType = getEventType;
function getEventTypeString(cistEvent) {
    return cist_1.EventType[cistEvent.type];
}
exports.getEventTypeString = getEventTypeString;
function getEventTeacherIds(cistEvent) {
    return cistEvent.teachers.join(',');
}
exports.getEventTeacherIds = getEventTeacherIds;
function getEventTeachers(cistEvent, teachers) {
    return JSON.stringify(cistEvent.teachers.map(t => teachers.get(t)));
}
exports.getEventTeachers = getEventTeachers;
function getEventGroupIds(cistEvent) {
    return cistEvent.groups.join(',');
}
exports.getEventGroupIds = getEventGroupIds;
function getEventGroups(cistEvent, googleGroups) {
    return iterare_1.iterate(cistEvent.groups).map(g => googleGroups.get(g).name).join(',');
}
exports.getEventGroups = getEventGroups;
function getEventClassNumber(cistEvent) {
    return cistEvent.auditory;
}
exports.getEventClassNumber = getEventClassNumber;
function getEventRoomShortName(cistEvent) {
    return cistEvent.groups.join(',');
}
exports.getEventRoomShortName = getEventRoomShortName;
function getEventSummary(title, cistEvent, googleGroups) {
    return `${title}, ${iterare_1.iterate(cistEvent.groups).map(g => googleGroups.get(g).name).join(', ')}`;
}
exports.getEventSummary = getEventSummary;
function hashCistEvent(cistEvent) {
    return `${cistEvent.subject_id}t${cistEvent.type}t${cistEvent.start_time}t${cistEvent.end_time}`;
} // t${cistEvent.teachers.join('s')} - FIXME: add if needed
exports.hashCistEvent = hashCistEvent;
function tryGetGoogleEventHash(googleEvent) {
    return !googleEvent.id ? null : base32_1.decode(googleEvent.id);
}
exports.tryGetGoogleEventHash = tryGetGoogleEventHash;
function hashGoogleEvent(googleEvent) {
    var _a, _b, _c;
    if (!((_a = googleEvent === null || googleEvent === void 0 ? void 0 : googleEvent.extendedProperties) === null || _a === void 0 ? void 0 : _a.shared)
        || !((_b = googleEvent.start) === null || _b === void 0 ? void 0 : _b.dateTime)
        || !((_c = googleEvent.end) === null || _c === void 0 ? void 0 : _c.dateTime)) {
        throw new TypeError('Shared extended properties or start & end dates are not found in Google Event');
    }
    // tslint:disable-next-line:max-line-length
    const sharedProperties = googleEvent.extendedProperties.shared;
    if (!sharedProperties.type || !sharedProperties.subjectId) {
        throw new TypeError('Required shared extended properties are not found in Google Event');
    }
    return `${sharedProperties.subjectId}t${sharedProperties.type}t${moment(googleEvent.start.dateTime).unix()}t${moment(googleEvent.start.dateTime).unix()}`;
}
exports.hashGoogleEvent = hashGoogleEvent;
function eventHashToEventId(eventHash) {
    return base32_1.encode(eventHash);
}
exports.eventHashToEventId = eventHashToEventId;
function getGoogleEventColor(eventType) {
    if (eventType / 10 < 1) {
        return 'fbd75b';
    }
    if (eventType / 10 < 2) {
        return '7ae7bf';
    }
    if (eventType / 10 < 3) {
        return 'dbadff';
    }
    if (eventType / 10 < 4) {
        return 'a4bdfc';
    }
    if (eventType / 10 < 5) {
        return 'ff887c';
    }
    if (eventType / 10 < 6) {
        return '5484ed';
    }
    return 'e1e1e1';
}
exports.getGoogleEventColor = getGoogleEventColor;
function getGoogleRoomShortName(googleRoom) {
    return googleRoom.resourceName;
}
exports.getGoogleRoomShortName = getGoogleRoomShortName;
function getResourceDescription(cistBuilding, cistRoom) {
    return `${cistBuilding.short_name}\n${JSON.stringify(cistRoom)}`;
}
exports.getResourceDescription = getResourceDescription;
function getUserVisibleDescription(cistBuilding, cistRoom) {
    let userVisibleDescription = `${cistRoom.short_name}, ${cistBuilding.full_name}`;
    if (cistRoom.is_have_power === '1') {
        userVisibleDescription += ', has power';
    }
    return userVisibleDescription;
}
exports.getUserVisibleDescription = getUserVisibleDescription;
function throwInvalidGroupEmailError(email) {
    throw new errors_1.FatalError(`Invalid group email ${email}`);
}
//# sourceMappingURL=google-utils.service.js.map