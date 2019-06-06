import { admin_directory_v1 } from 'googleapis';
import { inject, injectable } from 'inversify';
import { TYPES } from '../../di/types';
import {
  ApiAuditoriesResponse,
  ApiAuditory, ApiBuilding,
} from '../cist-json-client.service';
import { GoogleApiAdmin } from './google-api-admin';
import Schema$CalendarResource = admin_directory_v1.Schema$CalendarResource;
import Schema$Building = admin_directory_v1.Schema$Building;

@injectable()
export class RoomsService {
  static readonly ROOMS_PAGE_SIZE = 1000;
  static readonly CONFERENCE_ROOM = 'CONFERENCE_ROOM';
  private readonly _admin: GoogleApiAdmin;
  private readonly _rooms: admin_directory_v1.Resource$Resources$Calendars;

  constructor(@inject(TYPES.GoogleApiAdmin) googleAdmin: GoogleApiAdmin) {
    this._admin = googleAdmin;
    this._rooms = this._admin.googleAdmin.resources.calendars;
  }

  async ensureRooms(cistResponse: ApiAuditoriesResponse) {
    const rooms = await this.loadRooms();

    const promises = [];
    const processedIds = new Set<string>();
    for (const cistBuilding of cistResponse.university.buildings) {
      for (const cistRoom of cistBuilding.auditories) {
        const cistRoomId = this.getRoomId(cistRoom, cistBuilding);
        if (rooms.some(r => r.resourceId === cistRoomId)) {
          promises.push(
            this._rooms.update({
              calendarResourceId: cistRoomId,
              requestBody: this.cistAuditoryToGoogleRoom(cistRoom, cistRoomId),
            }),
          );
        } else {
          promises.push(
            this._rooms.insert({
              requestBody: this.cistAuditoryToGoogleRoom(cistRoom, cistRoomId),
            }),
          );
        }
        processedIds.add(cistRoomId);
      }
    }
    for (const googleRoom of rooms) {
      if (!processedIds.has(googleRoom.resourceId!)) {
        promises.push(
          this._rooms.delete({
            calendarResourceId: googleRoom.resourceId,
          }),
        );
      }
    }
    return Promise.all(promises as any);
  }

  private async loadRooms() {
    let rooms = [] as Schema$CalendarResource[];
    let roomsPage = null;
    do {
      roomsPage = await this._rooms.list({
        customer: 'my_customer', // FIXME: move to config or clarify
        maxResults: RoomsService.ROOMS_PAGE_SIZE,
        nextPage: roomsPage ? roomsPage.data.nextPageToken : null,
      } as admin_directory_v1.Params$Resource$Resources$Calendars$List);
      if (roomsPage.data.items) {
        rooms = rooms.concat(
          // Flexible filtering for rooms only. Doesn't count category
          roomsPage.data.items.filter(i => i.resourceType),
        );
      }
    } while (roomsPage.data.nextPageToken);
    return rooms;
  }

  private getRoomId(room: ApiAuditory, building: ApiBuilding) {
    return `${building.id}_${room.id}`; // using composite id to ensure uniqueness
  }

  private cistAuditoryToGoogleRoom(cistRoom: ApiAuditory, roomId: string) {
    return { // TODO: add cist room types and is_have_power as features resources
      resourceId: roomId,
      resourceName: cistRoom.short_name,
      resourceDescription: cistRoom.short_name, // FIXME: whether add info about buildings or not
      userVisibleDescription: cistRoom.short_name,
      floorName: cistRoom.floor,
      resourceCategory: 'CONFERENCE_ROOM',
    } as Schema$CalendarResource;
  }
}
