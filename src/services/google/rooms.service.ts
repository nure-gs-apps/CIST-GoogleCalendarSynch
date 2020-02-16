import { admin_directory_v1 } from 'googleapis';
import { inject, injectable } from 'inversify';
import iterate from 'iterare';
import { Nullable } from '../../@types';
import { TYPES } from '../../di/types';
import {
  ApiAuditoriesResponse,
  ApiAuditory,
} from '../cist/cist-json-client.service';
import { logger } from '../logger.service';
import { QuotaLimiterService } from '../quota-limiter.service';
import { customer } from './constants';
import { GoogleApiDirectory } from './google-api-directory';
import Schema$CalendarResource = admin_directory_v1.Schema$CalendarResource;
import { GaxiosPromise } from 'gaxios';
import { transformFloorname, UtilsService } from './utils.service';

@injectable()
export class RoomsService {
  static readonly ROOMS_PAGE_SIZE = 500; // maximum
  static readonly CONFERENCE_ROOM = 'CONFERENCE_ROOM';
  private readonly _utils: UtilsService;
  private readonly _directory: GoogleApiDirectory;
  private readonly _quotaLimiter: QuotaLimiterService;

  private readonly _rooms: admin_directory_v1.Resource$Resources$Calendars;

  private readonly _insert: admin_directory_v1.Resource$Resources$Calendars['insert'];
  private readonly _patch: admin_directory_v1.Resource$Resources$Calendars['patch'];
  private readonly _delete: admin_directory_v1.Resource$Resources$Calendars['delete'];
  private readonly _list: admin_directory_v1.Resource$Resources$Calendars['list'];

  private _cachedRooms: Nullable<Schema$CalendarResource[]>;
  private _cacheLastUpdate: Nullable<Date>;

  get cachedRooms() {
    return this._cachedRooms as Nullable<
      ReadonlyArray<Schema$CalendarResource>
    >;
  }
  get cacheLastUpdate() {
    return this._cacheLastUpdate
      ? new Date(this._cacheLastUpdate.getTime())
      : null;
  }

  constructor(
    @inject(TYPES.GoogleApiDirectory) googleApiDirectory: GoogleApiDirectory,
    @inject(
      TYPES.GoogleDirectoryQuotaLimiter,
    ) quotaLimiter: QuotaLimiterService,
    @inject(TYPES.GoogleUtils) utils: UtilsService,
  ) {
    this._utils = utils;

    this._directory = googleApiDirectory;
    this._rooms = this._directory.googleDirectory.resources.calendars;
    this._quotaLimiter = quotaLimiter;

    this._insert = this._quotaLimiter.limiter.wrap(
      this._rooms.insert.bind(this._rooms),
    ) as any;
    this._patch = this._quotaLimiter.limiter.wrap(
      this._rooms.patch.bind(this._rooms),
    ) as any;
    this._delete = this._quotaLimiter.limiter.wrap(
      this._rooms.delete.bind(this._rooms),
    ) as any;
    this._list = this._quotaLimiter.limiter.wrap(
      this._rooms.list.bind(this._rooms),
    ) as any;

    this._cachedRooms = null;
    this._cacheLastUpdate = null;
  }

  async ensureRooms(
    cistResponse: ApiAuditoriesResponse,
    preserveNameChanges = false,
  ) {
    const rooms = await this.getAllRooms();

    const promises = [] as GaxiosPromise<any>[];
    const newToOldNames = new Map<string, string>();
    for (const cistBuilding of cistResponse.university.buildings) {
      const buildingId = this._utils.getGoogleBuildingId(cistBuilding);
      for (const cistRoom of cistBuilding.auditories) {
        const cistRoomId = this._utils.getRoomId(cistRoom, cistBuilding);
        const googleRoom = rooms.find(
          r => r.resourceId === cistRoomId,
        );
        if (googleRoom) {
          const roomPatch = cistAuditoryToGoogleRoomPatch(
            cistRoom,
            googleRoom,
            buildingId,
          );
          if (roomPatch) {
            if (newToOldNames && roomPatch.resourceName) {
              newToOldNames.set(
                roomPatch.resourceName,
                // tslint:disable-next-line:no-non-null-assertion
                googleRoom.resourceName!,
              );
            }
            logger.debug(`Patching room ${cistRoomId} ${cistRoom.short_name}`);
            promises.push(
              this._patch({
                customer,
                calendarResourceId: cistRoomId,
                requestBody: roomPatch,
              }),
            );
          }
        } else {
          logger.debug(`Inserting room ${cistRoomId} ${cistRoom.short_name}`);
          promises.push(
            this._insert({
              customer,
              requestBody: cistAuditoryToInsertGoogleRoom(
                cistRoom,
                buildingId,
                cistRoomId,
              ),
            }),
          );
        }
      }
    }
    this.clearCache();
    await Promise.all(promises as any);
    return newToOldNames;
  }

  async deleteAll() {
    const rooms = await this.getAllRooms();
    const promises = [];
    for (const room of rooms) {
      promises.push(this._delete({
        customer,
        calendarResourceId: room.resourceId ?? undefined,
      }));
    }
    this.clearCache();
    return Promise.all(promises);
  }

  async deleteIrrelevant(cistResponse: ApiAuditoriesResponse) {
    const rooms = await this.getAllRooms();
    this.clearCache();
    return Promise.all(this.doDeleteByIds(
      rooms,
      iterate(rooms).filter(r => {
        for (const building of cistResponse.university.buildings) {
          const isRelevant = building.auditories.some(
            a => this._utils.isSameIdentity(a, building, r),
          );
          if (isRelevant) {
            return false;
          }
        }
        return true;
        // tslint:disable-next-line:no-non-null-assertion
      }).map(r => r.resourceId!).toSet(),
    ));
  }

  async deleteRelevant(cistResponse: ApiAuditoriesResponse) {
    const rooms = await this.getAllRooms();
    this.clearCache();
    return Promise.all(this.doDeleteByIds(
      rooms,
      iterate(rooms).filter(r => {
        for (const building of cistResponse.university.buildings) {
          const isRelevant = building.auditories.some(
          a => this._utils.isSameIdentity(a, building, r),
          );
          if (isRelevant) {
            return true;
          }
        }
        return false;
        // tslint:disable-next-line:no-non-null-assertion
      }).map(r => r.resourceId!).toSet(),
    ));
  }

  async getAllRooms(cacheResults = false) {
    let rooms = [] as Schema$CalendarResource[];
    let roomsPage = null;
    do {
      roomsPage = await this._list({
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
    if (cacheResults) {
      this._cachedRooms = rooms;
      this._cacheLastUpdate = new Date();
    }
    return rooms;
  }

  clearCache() {
    this._cachedRooms = null;
    this._cacheLastUpdate = null;
  }

  private doDeleteByIds(
    rooms: Schema$CalendarResource[],
    ids: Set<string>,
    promises = [] as GaxiosPromise<void>[],
  ) {
    for (const googleRoom of rooms) {
      // tslint:disable-next-line:no-non-null-assertion
      if (ids.has(googleRoom.resourceId!)) {
        promises.push(
          this._delete({
            customer,
            calendarResourceId: googleRoom.resourceId ?? undefined,
          }),
        );
      }
    }
    return promises;
  }
}

function cistAuditoryToInsertGoogleRoom(
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

function cistAuditoryToGoogleRoomPatch(
  cistRoom: ApiAuditory,
  googleRoom: Schema$CalendarResource,
  googleBuildingId: string,
) {
  let hasChanges = false;
  const roomPatch = {} as Schema$CalendarResource;
  if (googleBuildingId !== googleRoom.buildingId) {
    roomPatch.buildingId = googleBuildingId;
    hasChanges = true;
  }
  if (cistRoom.short_name !== googleRoom.resourceName) {
    roomPatch.resourceName = cistRoom.short_name;
    hasChanges = true;
  }
  if (cistRoom.short_name !== googleRoom.resourceDescription) {
    roomPatch.resourceDescription = cistRoom.short_name;
    hasChanges = true;
  }
  if (cistRoom.short_name !== googleRoom.userVisibleDescription) {
    roomPatch.userVisibleDescription = cistRoom.short_name;
    hasChanges = true;
  }
  const floorName = transformFloorname(cistRoom.floor);
  if (floorName !== googleRoom.floorName) {
    roomPatch.floorName = floorName;
    hasChanges = true;
  }
  return hasChanges ? roomPatch : null;
}
