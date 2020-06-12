import { admin_directory_v1, calendar_v3 } from 'googleapis';
import { inject, injectable } from 'inversify';
import { iterate } from 'iterare';
import { DeepReadonly, Nullable, Optional } from '../../@types';
import { TYPES } from '../../di/types';
import { fromBase64, toBase64 } from '../../utils/common';
import { toTranslit } from '../../utils/translit';
import {
  CistRoom,
  CistBuilding,
  CistGroup, CistEvent, EventType,
} from '../../@types/cist';
import { FatalError } from './errors';
import Schema$Building = admin_directory_v1.Schema$Building;
import Schema$CalendarResource = admin_directory_v1.Schema$CalendarResource;
import Schema$Group = admin_directory_v1.Schema$Group;
import Schema$Event = calendar_v3.Schema$Event;

export const buildingIdPrefix = 'b';
export const roomIdPrefix = 'r';

@injectable()
export class GoogleUtilsService {
  private readonly _idPrefix: Optional<string>;
  private readonly _groupEmailPrefix: Optional<string>;
  readonly domainName: string;
  readonly prependIdPrefix: (id: string) => string;
  readonly removeIdPrefix: (id: string) => string;
  readonly prependGroupEmailPrefix: (email: string) => string;

  eventColorToId: Map<string, string>;

  constructor(
    @inject(TYPES.GoogleAuthSubject) subject: string,
    @inject(TYPES.GoogleEntityIdPrefix) idPrefix: Nullable<string>,
    @inject(TYPES.GoogleGroupEmailPrefix) groupEmailPrefix: Nullable<string>,
  ) {
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

  toGoogleEvent(cistEvent: CistEvent): Schema$Event { // TODO: get names for shit
    const event: Schema$Event = {
      anyoneCanAddSelf: false,
      attendees: [], // TODO: add groups, room, teachers
      attendeesOmitted: false,
      description: '',
      extendedProperties: {
        shared: { // TODO: add names
          subjectId: cistEvent.subject_id.toString(),
          type: cistEvent.type.toString(),
          teacherIds: cistEvent.teachers.join(','),
          groupIds: cistEvent.groups.join(','),
          classNumber: cistEvent.number_pair.toString(),
          roomShortName: cistEvent.auditory,
        }
      },
      gadget: {
        type: cistEvent.type.toString(), // TODO: check if allowed
        title: '', // TODO: as description, but maybe briefer
      },
      guestsCanInviteOthers: false,
      guestsCanModify: false,
      guestsCanSeeOtherGuests: true,
      id: hashBase32HexCistEvent(cistEvent),
      location: '', // TODO: set to nure address + building & room
      reminders: {
        useDefault: true, // FIXME: check if this is enough for reminders
      },
      source: {
        title: 'NURE CIST',
        url: '', // TODO: set CIST url from config
      },
      start: {
        dateTime: '' // TODO: RFC3339
      },
      end: {
        dateTime: '' // TODO: RFC3339
      },
      endTimeUnspecified: false,
      status: 'confirmed',
      summary: '', // TODO: title, maybe the same as for gadget
      transparency: 'opaque',
      visibility: 'public',
    };
    const colorId = getGoogleEventColor(cistEvent.type);
    if (colorId) {
      event.colorId = colorId;
    }
    return event;
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

export function hashBase32HexCistEvent(cistEvent: CistEvent) {
  return `${cistEvent.subject_id}e${cistEvent.teachers.join('s')}e${cistEvent.type}e${cistEvent.start_time}e${cistEvent.end_time}`;
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
