import { admin_directory_v1 } from 'googleapis';
import { inject, injectable } from 'inversify';
import iterate from 'iterare';
import { TYPES } from '../../di/types';
import { toTranslit } from '../../utils/translit';
import {
  ApiAuditoriesResponse,
  ApiAuditory, ApiBuilding,
} from '../cist-json-client.service';
import { logger } from '../logger.service';
import { getGoogleBuildingId, transformFloorname } from './buildings.service';
import { customer, idPrefix } from './constants';
import { GoogleApiAdmin } from './google-api-admin';
import Schema$CalendarResource = admin_directory_v1.Schema$CalendarResource;
import { GaxiosPromise } from 'gaxios';

@injectable()
export class RoomsService {
  static readonly ROOMS_PAGE_SIZE = 500; // maximum
  static readonly CONFERENCE_ROOM = 'CONFERENCE_ROOM';
  private readonly _admin: GoogleApiAdmin;
  private readonly _rooms: admin_directory_v1.Resource$Resources$Calendars;

  constructor(@inject(TYPES.GoogleApiAdmin) googleAdmin: GoogleApiAdmin) {
    this._admin = googleAdmin;
    this._rooms = this._admin.googleAdmin.resources.calendars;
  }

  async ensureRooms(
    cistResponse: ApiAuditoriesResponse,
  ) {
    const rooms = await this.getAllRooms();

    const promises = [] as GaxiosPromise<any>[];
    for (const cistBuilding of cistResponse.university.buildings) {
      const buildingId = getGoogleBuildingId(cistBuilding);
      for (const cistRoom of cistBuilding.auditories) {
        const cistRoomId = getRoomId(cistRoom, cistBuilding);
        if (rooms.some(r => r.resourceId === cistRoomId)) {
          logger.debug(`Updating room ${cistRoomId}`);
          promises.push(
            this._rooms.update({
              customer,
              calendarResourceId: cistRoomId,
              requestBody: cistAuditoryToGoogleRoom(
                cistRoom,
                buildingId,
                cistRoomId,
              ),
            }),
          );
        } else {
          logger.debug(`Inserting room ${cistRoomId}`);
          promises.push(
            this._rooms.insert({
              customer,
              requestBody: cistAuditoryToGoogleRoom(
                cistRoom,
                buildingId,
                cistRoomId,
              ),
            }),
          );
        }
      }
    }
    return Promise.all(promises as any);
  }

  async deleteAll() {
    const rooms = await this.getAllRooms();
    const promises = [];
    for (const room of rooms) {
      promises.push(this._rooms.delete({
        customer,
        calendarResourceId: room.resourceId,
      }));
    }
    return Promise.all(promises);
  }

  async deleteIrrelevant(cistResponse: ApiAuditoriesResponse) {
    const rooms = await this.getAllRooms();
    return Promise.all(this.doDeleteByIds(
      rooms,
      iterate(rooms).filter(r => {
        for (const building of cistResponse.university.buildings) {
          const isIrrelevant = !building.auditories.some(
            a => r.resourceId === getRoomId(a, building),
          );
          if (isIrrelevant) {
            return true;
          }
        }
        return false;
      }).map(r => r.resourceId!).toSet(),
    ));
  }

  async deleteRelevant(cistResponse: ApiAuditoriesResponse) {
    const rooms = await this.getAllRooms();
    return Promise.all(this.doDeleteByIds(
      rooms,
      iterate(rooms).filter(r => {
        for (const building of cistResponse.university.buildings) {
          const isRelevant = building.auditories.some(
          a => r.resourceId === getRoomId(a, building),
          );
          if (isRelevant) {
            return true;
          }
        }
        return false;
      }).map(r => r.resourceId!).toSet(),
    ));
  }

  async getAllRooms() {
    let rooms = [] as Schema$CalendarResource[];
    let roomsPage = null;
    do {
      roomsPage = await this._rooms.list({
        customer,
        maxResults: RoomsService.ROOMS_PAGE_SIZE,
        nextPage: roomsPage ? roomsPage.data.nextPageToken : null,
      } as admin_directory_v1.Params$Resource$Resources$Calendars$List);
      if (roomsPage.data.items) {
        rooms = rooms.concat(
          // Flexible filtering for rooms only. Doesn't count on category
          roomsPage.data.items.filter(i => !i.resourceType),
        );
      }
    } while (roomsPage.data.nextPageToken);
    return rooms;
  }

  private doDeleteByIds(
    rooms: Schema$CalendarResource[],
    ids: Set<string>,
    promises = [] as GaxiosPromise<void>[],
  ) {
    for (const googleRoom of rooms) {
      if (ids.has(googleRoom.resourceId!)) {
        promises.push(
          this._rooms.delete({
            customer,
            calendarResourceId: googleRoom.resourceId,
          }),
        );
      }
    }
    return promises;
  }
}

function cistAuditoryToGoogleRoom(
  cistRoom: ApiAuditory,
  googleBuildingId: string,
  roomId: string,
) {
  const room: Schema$CalendarResource = { // TODO: add cist room types and is_have_power as features resources
    resourceId: roomId,
    buildingId: googleBuildingId,
    resourceName: cistRoom.short_name,
    capacity: 999, // unlimited
    resourceDescription: cistRoom.short_name, // FIXME: whether add info about buildings or not
    userVisibleDescription: cistRoom.short_name,
    floorName: transformFloorname(cistRoom.floor),
    resourceCategory: 'CONFERENCE_ROOM',
  };
  return room;
}

export function getRoomId(room: ApiAuditory, building: ApiBuilding) {
  return `${idPrefix}.${toTranslit(building.id)}.${toTranslit(room.id)}`; // using composite id to ensure uniqueness
}
