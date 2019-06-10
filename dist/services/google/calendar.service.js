"use strict";
var CalendarService_1;
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
"use strict";
const config = require("config");
const inversify_1 = require("inversify");
const types_1 = require("../../di/types");
const quota_limiter_service_1 = require("../quota-limiter.service");
const constants_1 = require("./constants");
const google_api_calendar_1 = require("./google-api-calendar");
let CalendarService = CalendarService_1 = class CalendarService {
    constructor(googleApiCalendar, quotaLimiter, calendarConfig) {
        this._calendar = googleApiCalendar;
        this._calendarConfig = calendarConfig;
        this._getCalendar = quotaLimiter.limiter.wrap(this._calendar.googleCalendar.calendars.get.bind(this._calendar.googleCalendar.calendars));
        this._listCalendarList = quotaLimiter.limiter.wrap(this._calendar.googleCalendar.calendarList.list.bind(this._calendar.googleCalendar.calendarList));
        this._insertCalendar = quotaLimiter.limiter.wrap(this._calendar.googleCalendar.calendars.insert.bind(this._calendar.googleCalendar.calendars));
        this._patchCalendar = quotaLimiter.limiter.wrap(this._calendar.googleCalendar.calendars.patch.bind(this._calendar.googleCalendar.calendars));
        this._insertAcl = quotaLimiter.limiter.wrap(this._calendar.googleCalendar.acl.insert.bind(this._calendar.googleCalendar.acl));
    }
    async ensureCalendars(groupsResponse, roomsResponse, newToOldGroupNames, newToOldRoomNames) {
        const c = {
            groupCalendars: new Map(),
            roomCalendars: new Map(),
        };
        const promises = [];
        const calendars = await this.getAllCalendars();
        // Groups
        for (const faculty of groupsResponse.university.faculties) {
            for (const direction of faculty.directions) {
                if (direction.groups) {
                    for (const group of direction.groups) {
                        promises.push(this.ensureGroupCalendar(calendars, group, c.groupCalendars, newToOldGroupNames));
                    }
                }
                for (const speciality of direction.specialities) {
                    for (const group of speciality.groups) {
                        promises.push(this.ensureGroupCalendar(calendars, group, c.groupCalendars, newToOldGroupNames));
                    }
                }
            }
        }
        // Rooms
        for (const building of roomsResponse.university.buildings) {
            for (const room of building.auditories) {
                promises.push(this.ensureRoomCalendar(calendars, room, c.roomCalendars, newToOldRoomNames));
            }
        }
        await Promise.all(promises);
        return c;
    }
    // async ensureCalendar() {
    //   if (this._calendarId) {
    //     try {
    //       return this._getCalendar({
    //         calendarId: this._calendarId,
    //       });
    //     } catch (err) {
    //       logger.debug(err);
    //       throw err;
    //     }
    //   }
    //   // return this.loadCalendar();
    //   return null;
    // }
    // private async loadCalendar() {
    //   const calendarList = await this.getAllCalendars();
    //   const calendar = calendarList.find(
    //     c => c.summary === this._calendarConfig.summary,
    //   );
    //   if (calendar) {
    //     this._calendarId = calendar.id!;
    //     return calendar;
    //   }
    //   return this.createCalendar();
    // }
    async getAllCalendars() {
        let calendars = [];
        let calendarPage = null;
        do {
            calendarPage = await this._listCalendarList({
                maxResults: CalendarService_1.CALENDAR_LIST_PAGE_SIZE,
                minAccessRole: 'writer',
                pageToken: calendarPage ? calendarPage.data.nextPageToken : undefined,
                showDeleted: false,
                showHidden: false,
            });
            if (calendarPage.data.items) {
                calendars = calendars.concat(calendarPage.data.items);
            }
        } while (calendarPage.data.nextPageToken);
        return calendars;
    }
    async ensureGroupCalendar(calendars, cistGroup, calendarMap, newToOldGroupNames) {
        let groupName = cistGroup.name;
        let changeName = false;
        if (newToOldGroupNames && newToOldGroupNames.has(groupName)) {
            groupName = newToOldGroupNames.get(groupName);
            changeName = true;
        }
        const groupNameWithPrefix = prependPrefix(groupName);
        let calendar = calendars.find(c => isGroupCorrespondingCalendar(groupNameWithPrefix, c));
        if (calendar) {
            if (changeName) {
                const response = await this._patchCalendar({
                    calendarId: calendar.id,
                    requestBody: getGroupCalendarPatch(cistGroup.name),
                });
                calendar = response.data;
            }
            calendarMap.set(cistGroup.name, calendar);
            return calendar;
        }
        calendar = await this.createCalendar(cistGroup.name, cistGroup.name);
        calendarMap.set(cistGroup.name, calendar);
        return calendar;
    }
    async ensureRoomCalendar(calendars, cistRoom, calendarMap, newToOldRoomNames) {
        let roomName = cistRoom.short_name;
        let changeName = false;
        if (newToOldRoomNames && newToOldRoomNames.has(roomName)) {
            roomName = newToOldRoomNames.get(roomName);
            changeName = true;
        }
        const roomNameWithPrefix = prependPrefix(roomName);
        let calendar = calendars.find(c => isRoomCorrespondingCalendar(roomNameWithPrefix, c));
        if (calendar) {
            if (changeName) {
                const response = await this._patchCalendar({
                    calendarId: calendar.id,
                    requestBody: getRoomCalendarPatch(cistRoom.short_name),
                });
                calendar = response.data;
            }
            calendarMap.set(cistRoom.short_name, calendar);
            return calendar;
        }
        calendar = await this.createCalendar(cistRoom.short_name, cistRoom.short_name);
        calendarMap.set(cistRoom.short_name, calendar);
        return calendar;
    }
    async createCalendar(summary, description) {
        const response = await this._insertCalendar({
            requestBody: {
                summary,
                description,
                timeZone: this._calendarConfig.timeZone,
            },
        });
        await Promise.all([
            this._insertAcl({
                calendarId: response.data.id,
                requestBody: {
                    role: 'reader',
                    scope: {
                        type: 'default',
                    },
                },
            }),
            this._insertAcl({
                calendarId: response.data.id,
                requestBody: {
                    role: 'reader',
                    scope: {
                        type: 'domain',
                        value: constants_1.domainName,
                    },
                },
            }),
        ]);
        return response.data;
    }
};
CalendarService.CALENDAR_LIST_PAGE_SIZE = 250; // maximum
CalendarService = CalendarService_1 = tslib_1.__decorate([
    inversify_1.injectable(),
    tslib_1.__param(0, inversify_1.inject(types_1.TYPES.GoogleApiCalendar)),
    tslib_1.__param(1, inversify_1.inject(types_1.TYPES.GoogleCalendarQuotaLimiter)),
    tslib_1.__param(2, inversify_1.inject(types_1.TYPES.GoogleCalendarConfig)),
    tslib_1.__metadata("design:paramtypes", [google_api_calendar_1.GoogleApiCalendar,
        quota_limiter_service_1.QuotaLimiterService, Object])
], CalendarService);
exports.CalendarService = CalendarService;
function isGroupCorrespondingCalendar(groupNameWithPrefix, calendar) {
    return calendar.summary === groupNameWithPrefix;
}
exports.isGroupCorrespondingCalendar = isGroupCorrespondingCalendar;
function isRoomCorrespondingCalendar(groupNameWithPrefix, calendar) {
    return calendar.summary === groupNameWithPrefix;
}
exports.isRoomCorrespondingCalendar = isRoomCorrespondingCalendar;
function getGroupCalendarPatch(groupName) {
    return {
        summary: prependPrefix(groupName),
        description: groupName,
    };
}
exports.getGroupCalendarPatch = getGroupCalendarPatch;
function getRoomCalendarPatch(groupName) {
    return {
        summary: prependPrefix(groupName),
        description: groupName,
    };
}
exports.getRoomCalendarPatch = getRoomCalendarPatch;
const prependPrefix = (() => {
    const calenarConfig = config.get('google.calendar');
    return calenarConfig.prefix
        ? (value) => calenarConfig.prefix + value
        : (value) => value;
})();
//# sourceMappingURL=calendar.service.js.map