import { isEqual } from 'lodash';
import { admin_directory_v1, calendar_v3 } from 'googleapis';
import { inject, injectable, optional } from 'inversify';
import { iterate } from 'iterare';
import {
  DeepReadonly,
  GuardedMap,
  Nullable,
  Optional,
} from '../../@types';
import { ICalendarConfig } from '../../@types/services';
import { TYPES } from '../../di/types';
import { fromBase64, toBase64 } from '../../utils/common';
import { toTranslit } from '../../utils/translit';
import {
  CistRoom,
  CistBuilding,
  CistGroup,
  CistEvent,
  EventType,
  CistSubject,
  CistTeacher,
  CistEventType,
} from '../../@types/cist';
import { FatalError } from './errors';
import Schema$Building = admin_directory_v1.Schema$Building;
import Schema$CalendarResource = admin_directory_v1.Schema$CalendarResource;
import Schema$Group = admin_directory_v1.Schema$Group;
import Schema$Event = calendar_v3.Schema$Event;
import moment = require('moment');
import Schema$EventAttendee = calendar_v3.Schema$EventAttendee;

export const buildingIdPrefix = 'b';
export const roomIdPrefix = 'r';

export interface IEventContext {
  subjects: GuardedMap<number, CistSubject>;
  googleGroups: GuardedMap<number, Schema$Group>;
  teachers: GuardedMap<number, CistTeacher>;
  roomEmailsByNames: GuardedMap<string, string>;
  types: GuardedMap<EventType, CistEventType>;
}

export interface IEventSharedExtendedProperties {
  subjectId: string;
  subject: string;
  type: string;
  typeString: string;
  teacherIds: string;
  teachers: string;
  groupIds: string;
  groups: string;
  classNumber: string;
  roomShortName: string;
}

@injectable()
export class GoogleUtilsService {
  private readonly _idPrefix: Optional<string>;
  private readonly _groupEmailPrefix: Optional<string>;
  readonly cistBaseUrl: Optional<string>;
  readonly calendarConfig: Optional<DeepReadonly<ICalendarConfig>>;
  readonly nureAddress: Optional<string>;
  readonly domainName: string;
  readonly prependIdPrefix: (id: string) => string;
  readonly removeIdPrefix: (id: string) => string;
  readonly prependGroupEmailPrefix: (email: string) => string;

  eventColorToId: Map<string, string>;

  constructor(
    @inject(TYPES.GoogleAuthSubject) subject: string,
    @inject(TYPES.GoogleEntityIdPrefix) idPrefix: Nullable<string>,
    @inject(TYPES.GoogleGroupEmailPrefix) groupEmailPrefix: Nullable<string>,
    @inject(TYPES.CistBaseApiUrl) @optional() cistBaseUrl: Optional<string>,
    @inject(
      TYPES.GoogleCalendarConfig
    ) @optional() calendarConfig: Optional<DeepReadonly<ICalendarConfig>>,
    @inject(TYPES.NureAddress) @optional() nureAddress: Optional<string>
  ) {
    this.cistBaseUrl = cistBaseUrl;
    this.calendarConfig = calendarConfig;
    this.nureAddress = nureAddress;
    this.domainName = subject.slice(subject.indexOf('@') + 1, subject.length)
      .toLowerCase();
    if (!idPrefix) {
      this.prependIdPrefix = id => id;
      this.removeIdPrefix = id => id;
    } else {
      this._idPrefix = idPrefix;
      this.prependIdPrefix = id => `${this._idPrefix}.${id}`;
      this.removeIdPrefix = id => id.slice(id.indexOf('.') + 1);
    }
    if (!groupEmailPrefix) {
      this.prependGroupEmailPrefix = email => email;
    } else {
      this._groupEmailPrefix = groupEmailPrefix;
      this.prependGroupEmailPrefix = email => `${this._groupEmailPrefix}_${email}`;
    }
    this.eventColorToId = new Map();
  }

  isSameBuildingIdentity(
    cistBuilding: DeepReadonly<CistBuilding>,
    googleBuilding: DeepReadonly<Schema$Building>,
  ) {
    return googleBuilding.buildingId === this.getGoogleBuildingId(cistBuilding);
  }

  isSameIdentity(
    cistRoom: DeepReadonly<CistRoom>,
    building: DeepReadonly<CistBuilding>,
    googleRoom: DeepReadonly<Schema$CalendarResource>,
  ) {
    return googleRoom.resourceId === this.getRoomId(cistRoom, building);
  }

  getGoogleBuildingId(cistBuilding: DeepReadonly<CistBuilding>) {
    return this.prependIdPrefix(`${buildingIdPrefix}.${toBase64(cistBuilding.id)}`);
  }

  getCistBuildingId(googleBuildingId: string) {
    const id = this.removeIdPrefix(googleBuildingId);
    return fromBase64(id.slice(id.indexOf('.') + 1));
  }

  getRoomId(
    room: DeepReadonly<CistRoom>,
    building: DeepReadonly<CistBuilding>,
  ) {
    return this.prependIdPrefix(`${roomIdPrefix}.${toBase64(building.id)}.${toBase64(room.id)}`); // using composite id to ensure uniqueness
  }

  getGroupEmail(cistGroup: DeepReadonly<CistGroup>) {
    const uniqueHash = cistGroup.id.toString();
    const localPartTemplate = [this.prependGroupEmailPrefix(''), `_${uniqueHash}`];
    // is OK for google email, but causes collisions
    const groupName = toTranslit(
      cistGroup.name,
      64 - (localPartTemplate[0].length + localPartTemplate[1].length), // undergo google email limit
    )
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

  getGroupIdFromEmail(email: string) {
    const atSignIndex = email.indexOf('@');
    if (atSignIndex < 0) {
      throwInvalidGroupEmailError(email);
    }
    const id = Number.parseFloat(email.slice(
      email.lastIndexOf('_', atSignIndex) + 1,
      atSignIndex
    ));
    if (Number.isNaN(id)) {
      throwInvalidGroupEmailError(email);
    }
    return id;
  }

  toGoogleEvent(
    cistEvent: DeepReadonly<CistEvent>,
    context: DeepReadonly<IEventContext>,
  ): Schema$Event {
    if (!this.calendarConfig) {
      throw new TypeError('Calendar config is required');
    }
    const type = context.types.get(cistEvent.type);
    const subject = context.subjects.get(cistEvent.subject_id);
    const title = `${subject.brief} ${cistEvent.auditory} ${type.short_name}`;
    const event: Schema$Event = {
      anyoneCanAddSelf: false,
      attendeesOmitted: false,
      attendees: this.createEventAttendees(cistEvent, context),
      description: this.createEventDescription(
        cistEvent,
        context,
        subject,
        type,
      ),
      extendedProperties: {
        shared: {
          subjectId: cistEvent.subject_id.toString(),
          subject: JSON.stringify(subject),
          type: cistEvent.type.toString(),
          typeString: EventType[cistEvent.type],
          teacherIds: cistEvent.teachers.join(','),
          teachers: JSON.stringify(
            cistEvent.teachers.map(t => context.teachers.get(t))
          ),
          groupIds: cistEvent.groups.join(','),
          groups: iterate(cistEvent.groups)
            .map(g => context.googleGroups.get(g).name)
            .join(','),
          classNumber: cistEvent.number_pair.toString(),
          roomShortName: cistEvent.auditory,
        }
      },
      gadget: {
        title,
        type: cistEvent.type.toString(), // TODO: check if allowed
      },
      guestsCanInviteOthers: false,
      guestsCanModify: false,
      guestsCanSeeOtherGuests: true,
      id: hashBase32HexCistEvent(cistEvent),
      reminders: {
        useDefault: true, // FIXME: check if this is enough for reminders
      },
      source: {
        title: 'NURE CIST'
      },
      start: {
        dateTime: moment.unix(cistEvent.start_time)
          .tz(this.calendarConfig.timeZone)
          .toISOString(true),
      },
      end: {
        dateTime: moment.unix(cistEvent.end_time)
          .tz(this.calendarConfig.timeZone)
          .toISOString(true)
      },
      endTimeUnspecified: false,
      status: 'confirmed',
      summary: `${title}, ${iterate(cistEvent.groups).map(g => context.googleGroups.get(g).name).join(', ')}`,
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

  createEventPatch(
    event: Schema$Event,
    cistEvent: DeepReadonly<CistEvent>,
    context: DeepReadonly<IEventContext>,
  ) {
    if (!this.calendarConfig) {
      throw new TypeError('Calendar config is required');
    }
    let hasChanges = false;
    const eventPatch: Schema$Event = {};
    const attendees = this.createEventAttendees(cistEvent, context);
    if (!isEqual(event.attendees, attendees)) {
      eventPatch.attendees = attendees;
      hasChanges = true;
    }
    const type = context.types.get(cistEvent.type);
    const subject = context.subjects.get(cistEvent.subject_id);
    const description = this.createEventDescription(
      cistEvent,
      context,
      subject,
      type,
    );
    if (description !== event.description) {
      eventPatch.description = description;
      hasChanges = true;
    }
    return hasChanges ? eventPatch : null;
  }

  createEventAttendees(
    cistEvent: DeepReadonly<CistEvent>,
    context: DeepReadonly<IEventContext>,
  ): Schema$EventAttendee[] {
    const attendees: Schema$EventAttendee[] = [
      { // FIXME: maybe add displayName
        email: context.roomEmailsByNames.get(cistEvent.auditory),
        optional: false,
        resource: true,
        responseStatus: 'accepted',
      }
    ];
    // TODO: add teachers
    for (const groupId of cistEvent.groups) {
      attendees.push({ // FIXME: maybe add displayName
        email: context.googleGroups.get(groupId).email,
        optional: false,
        resource: false,
        responseStatus: 'accepted',
      });
    }
    return attendees;
  }

  createEventDescription(
    cistEvent: DeepReadonly<CistEvent>,
    context: DeepReadonly<IEventContext>,
    subject = context.subjects.get(cistEvent.subject_id),
    type = context.types.get(cistEvent.type),
  ) {
    return `${subject.title} (${subject.brief}), ${type.full_name} (${type.short_name}), ${
      cistEvent.auditory
    } \n${
      iterate(cistEvent.groups).map(g => context.googleGroups.get(g).name)
        .join(', ')
    } \n${
      iterate(cistEvent.teachers).map(t => context.teachers.get(t))
        .map(t => `${t.full_name} (${t.short_name})`).join(', ')
    } \nlesson #${cistEvent.number_pair}`;
  }

  getGoogleEventColorId(eventType: EventType): Optional<string> {
    return this.eventColorToId.get(
      getGoogleEventColor(eventType)
    ) ?? iterate(
      this.eventColorToId.entries()
    ).find(([c, id]) => {
      const first = c[0].toLowerCase();
      const second = c[1].toLowerCase();
      return first === c[2].toLowerCase() && first === c[4].toLowerCase()
        && second === c[3].toLowerCase() && second === c[5].toLowerCase();
    })?.[1];
  }
}

const emptyFloorName = /^\s*$/;
export function transformFloorName(floorName: string) {
  return !emptyFloorName.test(floorName) ? floorName : '_';
}

export function isSameGroupIdentity(
  cistGroup: DeepReadonly<CistGroup>,
  googleGroup: DeepReadonly<Schema$Group>,
) {
  // tslint:disable-next-line:no-non-null-assertion
  const emailParts = googleGroup.email!.split('@');
  const parts = emailParts[emailParts.length - 2].split('.');
  return cistGroup.id === Number.parseInt(parts[parts.length - 1], 10);
}

export function hashBase32HexCistEvent(cistEvent: DeepReadonly<CistEvent>) {
  return `${cistEvent.subject_id}T${cistEvent.teachers.join('S')}T${cistEvent.type}T${cistEvent.start_time}T${cistEvent.end_time}`;
}

export function getGoogleEventColor(eventType: EventType) {
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

function throwInvalidGroupEmailError(email: string): never {
  throw new FatalError(`Invalid group email ${email}`);
}
