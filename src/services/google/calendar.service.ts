import { calendar_v3 } from 'googleapis';
import * as config from 'config';
import { inject, injectable } from 'inversify';
import { ICalendarConfig, IConfig, Nullable } from '../../@types';
import { TYPES } from '../../di/types';
import {
  ApiAuditoriesResponse, ApiAuditory, ApiGroup,
  ApiGroupsResponse,
} from '../cist-json-client.service';
import { logger } from '../logger.service';
import { QuotaLimiterService } from '../quota-limiter.service';
import { domainName } from './constants';
import { GoogleApiCalendar } from './google-api-calendar';
import { getGroupEmail } from './groups.service';
import Schema$Calendar = calendar_v3.Schema$Calendar;
import Schema$CalendarListEntry = calendar_v3.Schema$CalendarListEntry;
import { GaxiosPromise } from 'gaxios';

export interface ICalendars {
  groupCalendars: Map<string, Schema$Calendar | Schema$CalendarListEntry>;
  roomCalendars: Map<string, Schema$Calendar | Schema$CalendarListEntry>;
}

@injectable()
export class CalendarService {
  static readonly CALENDAR_LIST_PAGE_SIZE = 250; // maximum
  private readonly _calendar: GoogleApiCalendar;
  private readonly _calendarConfig: ICalendarConfig;

  private readonly _getCalendar: calendar_v3.Resource$Calendars['get'];
  private readonly _listCalendarList: calendar_v3.Resource$Calendarlist['list'];
  private readonly _insertCalendar: calendar_v3.Resource$Calendars['insert'];
  private readonly _patchCalendar: calendar_v3.Resource$Calendars['patch'];
  private readonly _insertAcl: calendar_v3.Resource$Acl['insert'];

  constructor(
    @inject(TYPES.GoogleApiCalendar) googleApiCalendar: GoogleApiCalendar,
    @inject(TYPES.GoogleCalendarQuotaLimiter) quotaLimiter: QuotaLimiterService,
    @inject(TYPES.GoogleCalendarConfig) calendarConfig: ICalendarConfig,
  ) {
    this._calendar = googleApiCalendar;
    this._calendarConfig = calendarConfig;

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
    this._patchCalendar = quotaLimiter.limiter.wrap(
      this._calendar.googleCalendar.calendars.patch.bind(
        this._calendar.googleCalendar.calendars,
      ),
    ) as any;
    this._insertAcl = quotaLimiter.limiter.wrap(
      this._calendar.googleCalendar.acl.insert.bind(
        this._calendar.googleCalendar.acl,
      ),
    ) as any;
  }

  async ensureCalendars(
    groupsResponse: ApiGroupsResponse,
    roomsResponse: ApiAuditoriesResponse,
    newToOldGroupNames: Nullable<ReadonlyMap<string, string>>,
    newToOldRoomNames: Nullable<ReadonlyMap<string, string>>,
  ) {
    const c: ICalendars = {
      groupCalendars: new Map(),
      roomCalendars: new Map(),
    };
    const promises = [] as Promise<any>[];
    const calendars = await this.getAllCalendars();

    // Groups
    for (const faculty of groupsResponse.university.faculties) {
      for (const direction of faculty.directions) {
        if (direction.groups) {
          for (const group of direction.groups) {
            promises.push(this.ensureGroupCalendar(
              calendars,
              group,
              c.groupCalendars,
              newToOldGroupNames,
            ));
          }
        }
        for (const speciality of direction.specialities) {
          for (const group of speciality.groups) {
            promises.push(this.ensureGroupCalendar(
              calendars,
              group,
              c.groupCalendars,
              newToOldGroupNames,
            ));
          }
        }
      }
    }

    // Rooms
    for (const building of roomsResponse.university.buildings) {
      for (const room of building.auditories) {
        promises.push(this.ensureRoomCalendar(
          calendars,
          room,
          c.roomCalendars,
          newToOldRoomNames,
        ));
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

  private async getAllCalendars() {
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

  private async ensureGroupCalendar(
    calendars: ReadonlyArray<Schema$Calendar | Schema$CalendarListEntry>,
    cistGroup: ApiGroup,
    calendarMap: Map<string, Schema$Calendar | Schema$CalendarListEntry>,
    newToOldGroupNames: Nullable<ReadonlyMap<string, string>>,
  ) {
    let groupName = cistGroup.name;
    let changeName = false;
    if (newToOldGroupNames && newToOldGroupNames.has(groupName)) {
      groupName = newToOldGroupNames.get(groupName)!;
      changeName = true;
    }
    const groupNameWithPrefix = prependPrefix(groupName);
    let calendar = calendars.find(
      c => isGroupCorrespondingCalendar(groupNameWithPrefix, c),
    );
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

  private async ensureRoomCalendar(
    calendars: ReadonlyArray<Schema$Calendar | Schema$CalendarListEntry>,
    cistRoom: ApiAuditory,
    calendarMap: Map<string, Schema$Calendar | Schema$CalendarListEntry>,
    newToOldRoomNames: Nullable<ReadonlyMap<string, string>>,
  ) {
    let roomName = cistRoom.short_name;
    let changeName = false;
    if (newToOldRoomNames && newToOldRoomNames.has(roomName)) {
      roomName = newToOldRoomNames.get(roomName)!;
      changeName = true;
    }
    const roomNameWithPrefix = prependPrefix(roomName);
    let calendar = calendars.find(
      c => isRoomCorrespondingCalendar(roomNameWithPrefix, c),
    );
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
    calendar = await this.createCalendar(
      cistRoom.short_name,
      cistRoom.short_name,
    );
    calendarMap.set(cistRoom.short_name, calendar);
    return calendar;
  }

  private async createCalendar(summary: string, description: string) {
    const response = await this._insertCalendar({
      requestBody: {
        summary,
        description,
        timeZone: this._calendarConfig.timeZone,
      },
    });
    await Promise.all([
      this._insertAcl({
        calendarId: response.data.id!,
        requestBody: {
          role: 'reader',
          scope: {
            type: 'default',
          },
        },
      }),
      this._insertAcl({
        calendarId: response.data.id!,
        requestBody: {
          role: 'reader',
          scope: {
            type: 'domain',
            value: domainName,
          },
        },
      }),
    ]);
    return response.data;
  }
}

export function isGroupCorrespondingCalendar(
  groupNameWithPrefix: string,
  calendar: Schema$Calendar | Schema$CalendarListEntry,
) {
  return calendar.summary === groupNameWithPrefix;
}

export function isRoomCorrespondingCalendar(
  groupNameWithPrefix: string,
  calendar: Schema$Calendar | Schema$CalendarListEntry,
) {
  return calendar.summary === groupNameWithPrefix;
}

export function getGroupCalendarPatch(groupName: string) {
  return {
    summary: prependPrefix(groupName),
    description: groupName,
  } as Schema$Calendar;
}

export function getRoomCalendarPatch(groupName: string) {
  return {
    summary: prependPrefix(groupName),
    description: groupName,
  } as Schema$Calendar;
}

const prependPrefix = (() => {
  const calenarConfig = config.get<IConfig['google']['calendar']>(
    'google.calendar',
  );
  return calenarConfig.prefix
    ? (value: string) => calenarConfig.prefix + value
    : (value: string) => value;
})();
