import { admin_directory_v1 } from 'googleapis';
import { inject, injectable } from 'inversify';
import iterate from 'iterare';
import {
  DeepReadonly,
  DeepReadonlyArray,
  DeepReadonlyMap,
  Maybe,
  t,
} from '../../@types';
import { ILogger } from '../../@types/logging';
import { ITaskDefinition, TaskType } from '../../@types/tasks';
import { TYPES } from '../../di/types';
import {
  ApiRoomsResponse,
  ApiRoom, ApiBuilding,
} from '../../@types/cist';
import { QuotaLimiterService } from '../quota-limiter.service';
import { customer } from './constants';
import { FatalError } from './errors';
import { GoogleApiAdminDirectory } from './google-api-admin-directory';
import Schema$CalendarResource = admin_directory_v1.Schema$CalendarResource;
import { GaxiosPromise } from 'gaxios';
import { transformFloorName, GoogleUtilsService } from './google-utils.service';

export interface IRoomsTaskContext {
  readonly cistRoomsMap: DeepReadonlyMap<string, [ApiRoom, ApiBuilding]>;
  readonly googleRoomsMap: DeepReadonlyMap<string, Schema$CalendarResource>;
}

@injectable()
export class RoomsService {
  static readonly ROOMS_PAGE_SIZE = 500; // maximum
  static readonly CONFERENCE_ROOM = 'CONFERENCE_ROOM';
  private readonly _directory: GoogleApiAdminDirectory;
  private readonly _quotaLimiter: QuotaLimiterService;
  private readonly _utils: GoogleUtilsService;
  private readonly _logger: ILogger;

  private readonly _rooms: admin_directory_v1.Resource$Resources$Calendars;

  private readonly _insert: admin_directory_v1.Resource$Resources$Calendars['insert'];
  private readonly _patch: admin_directory_v1.Resource$Resources$Calendars['patch'];
  private readonly _delete: admin_directory_v1.Resource$Resources$Calendars['delete'];
  private readonly _list: admin_directory_v1.Resource$Resources$Calendars['list'];

  constructor(
    @inject(
      TYPES.GoogleApiAdminDirectory
    ) googleApiAdminDirectory: GoogleApiAdminDirectory,
    @inject(
      TYPES.GoogleAdminDirectoryQuotaLimiter,
    ) quotaLimiter: QuotaLimiterService,
    @inject(TYPES.GoogleUtils) utils: GoogleUtilsService,
    @inject(TYPES.Logger) logger: ILogger,
  ) {
    this._utils = utils;
    this._logger = logger;

    this._directory = googleApiAdminDirectory;
    this._rooms = this._directory.googleAdminDirectory.resources.calendars;
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
  }

  /**
   * Doesn't handle errors properly
   */
  async ensureRooms(cistResponse: DeepReadonly<ApiRoomsResponse>) {
    const rooms = await this.getAllRooms();

    const promises = [] as GaxiosPromise[];
    for (const cistBuilding of cistResponse.university.buildings) {
      const buildingId = this._utils.getGoogleBuildingId(cistBuilding);
      for (const cistRoom of cistBuilding.auditories) {
        const cistRoomId = this._utils.getRoomId(cistRoom, cistBuilding);
        promises.push(this.doEnsureRoom(
          cistRoom,
          cistBuilding,
          rooms.find(
            r => r.resourceId === cistRoomId,
          ),
          buildingId,
          cistRoomId,
        ));
      }
    }
    await Promise.all(promises);
  }

  async createRoomsContext(
    cistResponse: DeepReadonly<ApiRoomsResponse>
  ): Promise<IRoomsTaskContext> {
    return {
      cistRoomsMap: toRoomsWithBuildings(cistResponse)
        .map(([a, b]) => t(this._utils.getRoomId(a, b), t(a, b)))
        .toMap(),
      googleRoomsMap: iterate(await this.getAllRooms())
        .filter(b => typeof b.buildingId === 'string')
        .map(b => t(b.buildingId as string, b))
        .toMap()
    };
  }

  createEnsureRoomsTask(
    cistResponse: DeepReadonly<ApiRoomsResponse>
  ): ITaskDefinition<string> {
    return {
      taskType: TaskType.EnsureRooms,
      steps: toRoomsWithBuildings(cistResponse)
        .map(([a, b]) => this._utils.getRoomId(a, b))
        .toArray(),
    };
  }

  async ensureRoom(
    cistRoomId: string,
    context: IRoomsTaskContext,
  ) {
    const cistData = context.cistRoomsMap.get(cistRoomId);
    if (!cistData) {
      throw new FatalError(`Room ${cistRoomId} is not found it context`);
    }
    await this.doEnsureRoom(
      cistData[0] as DeepReadonly<ApiRoom>,
      cistData[1] as DeepReadonly<ApiBuilding>,
      context.googleRoomsMap.get(cistRoomId),
      cistData[1].id,
      cistRoomId
    );
  }

  /**
   * Doesn't handle errors properly
   */
  async deleteAll() {
    const rooms = await this.getAllRooms();
    const promises = [];
    for (const room of rooms) {
      promises.push(this._delete({
        customer,
        calendarResourceId: room.resourceId ?? undefined,
      }));
    }
    return Promise.all(promises);
  }

  /**
   * Doesn't handle errors properly
   */
  async deleteIrrelevant(cistResponse: DeepReadonly<ApiRoomsResponse>) {
    const rooms = await this.getAllRooms();
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

  createDeleteIrrelevantTask(
    context: IRoomsTaskContext
  ): ITaskDefinition<string> {
    return {
      taskType: TaskType.DeleteIrrelevantRooms,
      steps: iterate(context.googleRoomsMap.keys())
        .filter(
          googleRoomId => typeof googleRoomId === 'string'
            && !context.cistRoomsMap.has(googleRoomId)
        )
        .map(id => id as string)
        .toArray(),
    };
  }

  async deleteRoomById(roomId: string) {
    return this.doDeleteById(roomId);
  }

  /**
   * Doesn't handle errors properly
   */
  async deleteRelevant(cistResponse: DeepReadonly<ApiRoomsResponse>) {
    const rooms = await this.getAllRooms();
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

  async getAllRooms() {
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
    return rooms;
  }

  private async doEnsureRoom(
    cistRoom: DeepReadonly<ApiRoom>,
    cistBuilding: DeepReadonly<ApiBuilding>,
    googleRoom: Maybe<DeepReadonly<Schema$CalendarResource>>,
    buildingId = this._utils.getGoogleBuildingId(cistBuilding),
    cistRoomId = this._utils.getRoomId(cistRoom, cistBuilding)
  ) {
    if (googleRoom) {
      const roomPatch = cistRoomToGoogleRoomPatch(
        cistRoom,
        googleRoom,
        buildingId,
      );
      if (roomPatch) {
        this._logger.info(`Patching room ${cistRoomId} ${cistRoom.short_name}`);
        return this._patch({
          customer,
          calendarResourceId: cistRoomId,
          requestBody: roomPatch,
        });
      }
    }
    this._logger.info(`Inserting room ${cistRoomId} ${cistRoom.short_name}`);
    return this._insert({
      customer,
      requestBody: cistRoomToInsertGoogleRoom(
        cistRoom,
        buildingId,
        cistRoomId,
      ),
    });
  }

  private doDeleteByIds(
    rooms: DeepReadonlyArray<Schema$CalendarResource>,
    ids: ReadonlySet<string>,
    promises = [] as GaxiosPromise<void>[],
  ) {
    for (const googleRoom of rooms) {
      if (googleRoom.resourceId && ids.has(googleRoom.resourceId)) {
        promises.push(this.doDeleteById(googleRoom.resourceId));
      }
    }
    return promises;
  }

  private doDeleteById(roomId: string) {
    return this._delete({
      customer,
      calendarResourceId: roomId,
    });
  }
}

function cistRoomToInsertGoogleRoom(
  cistRoom: DeepReadonly<ApiRoom>,
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
    floorName: transformFloorName(cistRoom.floor),
    resourceCategory: 'CONFERENCE_ROOM',
  };
  return room;
}

function cistRoomToGoogleRoomPatch(
  cistRoom: DeepReadonly<ApiRoom>,
  googleRoom: DeepReadonly<Schema$CalendarResource>,
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
  const floorName = transformFloorName(cistRoom.floor);
  if (floorName !== googleRoom.floorName) {
    roomPatch.floorName = floorName;
    hasChanges = true;
  }
  return hasChanges ? roomPatch : null;
}

function toRoomsWithBuildings(cistResponse: DeepReadonly<ApiRoomsResponse>) {
  return iterate(cistResponse.university.buildings)
    .map(b => iterate(b.auditories).map(a => t(a, b)))
    .flatten();
}
