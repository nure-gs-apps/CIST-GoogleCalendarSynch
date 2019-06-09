import { calendar_v3 } from 'googleapis';
import { inject, injectable } from 'inversify';
import { ICalendarConfig, Nullable } from '../../@types';
import { TYPES } from '../../di/types';
import { logger } from '../logger.service';
import { QuotaLimiterService } from '../quota-limiter.service';
import { GoogleApiCalendar } from './google-api-calendar';

@injectable()
export class CalendarService {
  static readonly CALENDAR_LIST_PAGE_SIZE = 250; // maximum
  private readonly _calendar: GoogleApiCalendar;
  private readonly _calendarConfig: ICalendarConfig;
  private _calendarId: Nullable<string>;

  private readonly _getCalendar: calendar_v3.Resource$Calendars['get'];
  private readonly _listCalendarList: calendar_v3.Resource$Calendarlist['list'];
  private readonly _insertCalendar: calendar_v3.Resource$Calendars['insert'];
  private readonly _insertAcl: calendar_v3.Resource$Acl['insert'];

  constructor(
    @inject(TYPES.GoogleApiCalendar) googleApiCalendar: GoogleApiCalendar,
    @inject(TYPES.GoogleCalendarQuotaLimiter) quotaLimiter: QuotaLimiterService,
    @inject(TYPES.GoogleCalendarConfig) calendarConfig: ICalendarConfig,
  ) {
    this._calendar = googleApiCalendar;
    this._calendarConfig = calendarConfig;
    this._calendarId = this._calendarConfig.id || null;

    this._getCalendar = quotaLimiter.limiter.wrap(
      this._calendar.googleCalendar.calendars.get.bind(
        this._calendar.googleCalendar.calendars,
      ),
    ) as any;
    this._listCalendarList = quotaLimiter.limiter.wrap(
      this._calendar.googleCalendar.calendarList.list.bind(
        this._calendar.googleCalendar.calendarList,
      ),
    ) as any;
    this._insertCalendar = quotaLimiter.limiter.wrap(
      this._calendar.googleCalendar.calendars.insert.bind(
        this._calendar.googleCalendar.calendars,
      ),
    ) as any;
    this._insertAcl = quotaLimiter.limiter.wrap(
      this._calendar.googleCalendar.acl.insert.bind(
        this._calendar.googleCalendar.acl,
      ),
    ) as any;
  }

  async ensureCalendar() {
    if (this._calendarId) {
      try {
        return this._getCalendar({
          calendarId: this._calendarId,
        });
      } catch (err) {
        logger.debug(err);
        throw err;
      }
    }
    return this.loadCalendar();
  }

  private async loadCalendar() {
    const calendarList = await this.getCalendars();
    const calendar = calendarList.find(
      c => c.summary === this._calendarConfig.summary,
    );
    if (calendar) {
      this._calendarId = calendar.id!;
      return calendar;
    }
    return this.createCalendar();
  }

  private async getCalendars() {
    let calendars = [] as calendar_v3.Schema$CalendarListEntry[];
    let calendarPage = null;
    do {
      calendarPage = await this._listCalendarList({
        maxResults: CalendarService.CALENDAR_LIST_PAGE_SIZE,
        minAccessRole: 'writer',
        pageToken: calendarPage ? calendarPage.data.nextPageToken : undefined,
        showDeleted: false,
        showHidden: false,
      } as calendar_v3.Params$Resource$Calendarlist$List);
      if (calendarPage.data.items) {
        calendars = calendars.concat(calendarPage.data.items);
      }
    } while (calendarPage.data.nextPageToken);
    return calendars;
  }

  private async createCalendar() {
    const response = await this._insertCalendar({
      requestBody: {
        summary: this._calendarConfig.summary,
        description: this._calendarConfig.summary,
        timeZone: this._calendarConfig.timeZone,
      },
    });
    this._calendarId = response.data.id!;
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
}
