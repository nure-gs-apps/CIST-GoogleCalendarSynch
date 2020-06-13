import { isEqual } from 'lodash';
import { encode } from '@januswel/base32';
import { admin_directory_v1, calendar_v3 } from 'googleapis';
import { inject, injectable, optional } from 'inversify';
import { iterate } from 'iterare';
import {
  DeepReadonly, DeepReadonlyGuardedMap,
  IGuardedMap, IReadonlyGuardedMap,
  Nullable,
  Optional,
} from '../../@types';
import { ICalendarConfig } from '../../@types/services';
import { TYPES } from '../../di/types';
import { fromBase64, isObjectLike, toBase64 } from '../../utils/common';
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
  subjects: IGuardedMap<number, CistSubject>;
  googleGroups: IGuardedMap<number, Schema$Group>;
  teachers: IGuardedMap<number, CistTeacher>;
  roomEmailsByNames: IGuardedMap<string, string>;
  types: IGuardedMap<EventType, CistEventType>;
}

export interface IEventSharedExtendedProperties {
  [key: string]: string;
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

  cistRoomToGoogleRoomPatch(
    cistRoom: DeepReadonly<CistRoom>,
    googleRoom: DeepReadonly<Schema$CalendarResource>,
    cistBuilding: DeepReadonly<CistBuilding>,
    googleBuildingId = this.getGoogleBuildingId(cistBuilding),
  ) {
    let hasChanges = false;
    const roomPatch = {} as Schema$CalendarResource;
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
    const userVisibleDescription = getUserVisibleDescription(
      cistBuilding,
      cistRoom,
    );
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

  cistRoomToInsertGoogleRoom(
    cistRoom: DeepReadonly<CistRoom>,
    cistBuilding: DeepReadonly<CistBuilding>,
    googleBuildingId = this.getGoogleBuildingId(cistBuilding),
    roomId = this.getRoomId(cistRoom, cistBuilding),
  ) {
    const room: Schema$CalendarResource = { // TODO: add cist room types and is_have_power as features resources
      resourceId: roomId,
      buildingId: googleBuildingId,
      resourceName: cistRoom.short_name,
      capacity: 999, // unlimited
      resourceDescription: getResourceDescription(cistBuilding, cistRoom),
      userVisibleDescription: getUserVisibleDescription(cistBuilding, cistRoom),
      floorName: transformFloorName(cistRoom.floor),
      resourceCategory: 'CONFERENCE_ROOM',
    };
    return room;
  }


  cistEventToGoogleEvent(
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
        shared: getEventSharedExtendedProperties(cistEvent, context, subject)
      },
      gadget: {
        title,
        type: cistEvent.type.toString(), // TODO: check if allowed
      },
      guestsCanInviteOthers: false,
      guestsCanModify: false,
      guestsCanSeeOtherGuests: true,
      id: encode(hashCistEvent(cistEvent)),
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

  cistEventToGoogleEventPatch(
    event: DeepReadonly<Schema$Event>,
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
    if (!event.extendedProperties?.shared) {
      eventPatch.extendedProperties = {
        shared: getEventSharedExtendedProperties(cistEvent, context, subject)
      };
    } else if (isObjectLike<IEventSharedExtendedProperties>(
      event.extendedProperties.shared
    )) {
      const patch = getEventSharedExtendedPropertiesPatch(
        cistEvent,
        event.extendedProperties.shared,
        context,
        subject
      );
      if (patch) {
        eventPatch.extendedProperties = {
          shared: patch as Record<string, string>
        };
      }
    }
    const gadgetType = cistEvent.type.toString();
    const title = `${subject.brief} ${cistEvent.auditory} ${type.short_name}`;
    if (!event.gadget) {
      eventPatch.gadget = {
        title,
        type: gadgetType, // TODO: check if allowed
      };
      hasChanges = true;
    } else {
      const gadget = {} as Record<string, string>;
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
    const id = encode(hashCistEvent(cistEvent));
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

export function getEventSharedExtendedProperties(
  cistEvent: DeepReadonly<CistEvent>,
  context: DeepReadonly<IEventContext>,
  subject = context.subjects.get(cistEvent.subject_id),
) {
  const object: IEventSharedExtendedProperties = {
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
export function getEventSharedExtendedPropertiesPatch(
  cistEvent: DeepReadonly<CistEvent>,
  // tslint:disable-next-line:max-line-length
  eventSharedExtendedProperties: Partial<DeepReadonly<IEventSharedExtendedProperties>>,
  context: DeepReadonly<IEventContext>,
  subject = context.subjects.get(cistEvent.subject_id),
) {
  const props = eventSharedExtendedProperties;
  let hasChanges = false;
  const patch: Partial<IEventSharedExtendedProperties> = {};
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
export function getEventSubjectId(cistEvent: DeepReadonly<CistEvent>) {
  return cistEvent.subject_id.toString();
}
export function getEventSubject(subject: DeepReadonly<CistSubject>) {
  return JSON.stringify(subject);
}
export function getEventType(cistEvent: DeepReadonly<CistEvent>) {
  return cistEvent.type.toString();
}
export function getEventTypeString(cistEvent: DeepReadonly<CistEvent>) {
  return EventType[cistEvent.type];
}
export function getEventTeacherIds(cistEvent: DeepReadonly<CistEvent>) {
  return cistEvent.teachers.join(',');
}
export function getEventTeachers(
  cistEvent: DeepReadonly<CistEvent>,
  teachers: IReadonlyGuardedMap<number, CistTeacher>,
) {
  return JSON.stringify(cistEvent.teachers.map(t => teachers.get(t)));
}
export function getEventGroupIds(cistEvent: DeepReadonly<CistEvent>) {
  return cistEvent.groups.join(',');
}
export function getEventGroups(
  cistEvent: DeepReadonly<CistEvent>,
  googleGroups: DeepReadonlyGuardedMap<number, Schema$Group>,
) {
  return iterate(cistEvent.groups).map(g => googleGroups.get(g).name).join(',');
}
export function getEventClassNumber(cistEvent: DeepReadonly<CistEvent>) {
  return cistEvent.auditory;
}
export function getEventRoomShortName(cistEvent: DeepReadonly<CistEvent>) {
  return cistEvent.groups.join(',');
}

export function getEventSummary(
  title: string,
  cistEvent: DeepReadonly<CistEvent>,
  googleGroups: DeepReadonlyGuardedMap<number, Schema$Group>,
) {
  return `${title}, ${iterate(cistEvent.groups).map(g => googleGroups.get(g).name).join(', ')}`;
}

export function hashCistEvent(cistEvent: DeepReadonly<CistEvent>) {
  return `${cistEvent.subject_id}t${cistEvent.type}t${cistEvent.start_time}t${cistEvent.end_time}`;
} // t${cistEvent.teachers.join('s')} - FIXME: add if needed

export function hashGoogleEvent(googleEvent: DeepReadonly<Schema$Event>) { // FIXME: add check for google event hash
  if (
    !googleEvent?.extendedProperties?.shared
    || !googleEvent.start?.dateTime
    || !googleEvent.end?.dateTime
  ) {
    throw new TypeError('Shared extended properties or start & end dates are not found in Google Event');
  }
  // tslint:disable-next-line:max-line-length
  const sharedProperties = googleEvent.extendedProperties.shared as Partial<IEventSharedExtendedProperties>;
  if (!sharedProperties.type || !sharedProperties.subjectId) {
    throw new TypeError('Required shared extended properties are not found in Google Event');
  }
  return `${sharedProperties.subjectId}t${sharedProperties.type}t${moment(googleEvent.start.dateTime).unix()}t${moment(googleEvent.start.dateTime).unix()}`;
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

export function getGoogleRoomShortName(
  googleRoom: DeepReadonly<Schema$CalendarResource>
) {
  return googleRoom.resourceName;
}

export function getResourceDescription(
  cistBuilding: DeepReadonly<CistBuilding>,
  cistRoom: DeepReadonly<CistRoom>,
) {
  return `${cistBuilding.short_name}\n${JSON.stringify(cistRoom)}`;
}

export function getUserVisibleDescription(
  cistBuilding: DeepReadonly<CistBuilding>,
  cistRoom: DeepReadonly<CistRoom>,
) {
  let userVisibleDescription = `${cistRoom.short_name}, ${cistBuilding.full_name}`;
  if (cistRoom.is_have_power === '1') {
    userVisibleDescription += ', has power';
  }
  return userVisibleDescription;
}

function throwInvalidGroupEmailError(email: string): never {
  throw new FatalError(`Invalid group email ${email}`);
}
