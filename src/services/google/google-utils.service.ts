import { admin_directory_v1 } from 'googleapis';
import { inject, injectable } from 'inversify';
import { Optional } from '../../@types';
import { ConfigService } from '../../config/config.service';
import { TYPES } from '../../di/types';
import { toBase64 } from '../../utils/common';
import { toTranslit } from '../../utils/translit';
import {
  ApiAuditory,
  ApiBuilding,
  ApiGroup,
} from '../cist/types';
import Schema$Building = admin_directory_v1.Schema$Building;
import Schema$CalendarResource = admin_directory_v1.Schema$CalendarResource;
import Schema$Group = admin_directory_v1.Schema$Group;

export const buildingIdPrefix = 'b';
export const roomIdPrefix = 'r';
export const groupEmailPrefix = 'g';

@injectable()
export class GoogleUtilsService {
  private readonly _idPrefix: Optional<string>;
  public readonly domainName: string;
  public readonly prependIdPrefix: (id: string) => string;

  constructor(@inject(TYPES.Config) config: ConfigService) {
    this.domainName = config.config
      .google
      .auth
      .subjectEmail.split('@')[1].toLowerCase();
    const idPrefix = config.config.google.idPrefix;
    if (!idPrefix) {
      this.prependIdPrefix = id => id;
    } else {
      this._idPrefix = idPrefix;
      this.prependIdPrefix = id => `${this._idPrefix}.${id}`;
    }
  }

  isSameBuildingIdentity(
    cistBuilding: ApiBuilding,
    googleBuilding: Schema$Building,
  ) {
    return googleBuilding.buildingId === this.getGoogleBuildingId(cistBuilding);
  }

  isSameIdentity(
    cistRoom: ApiAuditory,
    building: ApiBuilding,
    googleRoom: Schema$CalendarResource,
  ) {
    return googleRoom.resourceId === this.getRoomId(cistRoom, building);
  }

  getGoogleBuildingId(cistBuilding: ApiBuilding) {
    return this.prependIdPrefix(`${buildingIdPrefix}.${toBase64(cistBuilding.id)}`);
  }

  getRoomId(room: ApiAuditory, building: ApiBuilding) {
    return this.prependIdPrefix(`${roomIdPrefix}.${toBase64(building.id)}.${toBase64(room.id)}`); // using composite id to ensure uniqueness
  }

  getGroupEmail(cistGroup: ApiGroup) {
    const uniqueHash = cistGroup.id.toString();
    const localPartTemplate = [`${groupEmailPrefix}_`, `.${uniqueHash}`];
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
}

const emptyFloorName = /^\s*$/;
export function transformFloorname(floorName: string) {
  return !emptyFloorName.test(floorName) ? floorName : '_';
}

export function isSameGroupIdenity(
  cistGroup: ApiGroup,
  googleGroup: Schema$Group,
) {
  // tslint:disable-next-line:no-non-null-assertion
  const emailParts = googleGroup.email!.split('@');
  const parts = emailParts[emailParts.length - 2].split('.');
  return cistGroup.id === Number.parseInt(parts[parts.length - 1], 10);
}
