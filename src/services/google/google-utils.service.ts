import { admin_directory_v1 } from 'googleapis';
import { inject, injectable } from 'inversify';
import { DeepReadonly, Nullable, Optional } from '../../@types';
import { TYPES } from '../../di/types';
import { fromBase64, toBase64 } from '../../utils/common';
import { toTranslit } from '../../utils/translit';
import {
  CistRoom,
  CistBuilding,
  CistGroup, CistEvent,
} from '../../@types/cist';
import { FatalError } from './errors';
import Schema$Building = admin_directory_v1.Schema$Building;
import Schema$CalendarResource = admin_directory_v1.Schema$CalendarResource;
import Schema$Group = admin_directory_v1.Schema$Group;

export const buildingIdPrefix = 'b';
export const roomIdPrefix = 'r';

@injectable()
export class GoogleUtilsService {
  private readonly _idPrefix: Optional<string>;
  private readonly _groupEmailPrefix: Optional<string>;
  public readonly domainName: string;
  public readonly prependIdPrefix: (id: string) => string;
  public readonly removeIdPrefix: (id: string) => string;
  public readonly prependGroupEmailPrefix: (email: string) => string;

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

export function hashCistEvent(cistEvent: CistEvent) {
  return `${cistEvent.subject_id}.${cistEvent.type}.${cistEvent.start_time}.${cistEvent.end_time}`;
}

function throwInvalidGroupEmailError(email: string): never {
  throw new FatalError(`Invalid group email ${email}`);
}
