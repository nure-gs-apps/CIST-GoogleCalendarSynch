"use strict";
var CalendarService_1;
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
"use strict";
const inversify_1 = require("inversify");
const types_1 = require("../../di/types");
const logger_service_1 = require("../logger.service");
const quota_limiter_service_1 = require("../quota-limiter.service");
const google_api_calendar_1 = require("./google-api-calendar");
let CalendarService = CalendarService_1 = class CalendarService {
    constructor(googleApiCalendar, quotaLimiter, calendarConfig) {
        this._calendar = googleApiCalendar;
        this._calendarConfig = calendarConfig;
        this._calendarId = this._calendarConfig.id || null;
        this._getCalendar = quotaLimiter.limiter.wrap(this._calendar.googleCalendar.calendars.get.bind(this._calendar.googleCalendar.calendars));
        this._listCalendarList = quotaLimiter.limiter.wrap(this._calendar.googleCalendar.calendarList.list.bind(this._calendar.googleCalendar.calendarList));
        this._insertCalendar = quotaLimiter.limiter.wrap(this._calendar.googleCalendar.calendars.insert.bind(this._calendar.googleCalendar.calendars));
        this._insertAcl = quotaLimiter.limiter.wrap(this._calendar.googleCalendar.acl.insert.bind(this._calendar.googleCalendar.acl));
    }
    async ensureCalendar() {
        if (this._calendarId) {
            try {
                return this._getCalendar({
                    calendarId: this._calendarId,
                });
            }
            catch (err) {
                logger_service_1.logger.debug(err);
                throw err;
            }
        }
        return this.loadCalendar();
    }
    async loadCalendar() {
        const calendarList = await this.getCalendars();
        const calendar = calendarList.find(c => c.summary === this._calendarConfig.summary);
        if (calendar) {
            this._calendarId = calendar.id;
            return calendar;
        }
        return this.createCalendar();
    }
    async getCalendars() {
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
    async createCalendar() {
        const response = await this._insertCalendar({
            requestBody: {
                summary: this._calendarConfig.summary,
                description: this._calendarConfig.summary,
                timeZone: this._calendarConfig.timeZone,
            },
        });
        this._calendarId = response.data.id;
        await this._insertAcl({
            calendarId: this._calendarId,
            requestBody: {
                role: 'reader',
                scope: {
                    type: 'default',
                },
            },
        });
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
//# sourceMappingURL=calendar.service.js.map