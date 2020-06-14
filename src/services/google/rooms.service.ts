import { admin_directory_v1 } from 'googleapis';
import { inject, injectable } from 'inversify';
import iterate from 'iterare';
import {
  DeepReadonly,
  DeepReadonlyArray,
  DeepReadonlyMap,
  Maybe, Nullable,
  t,
} from '../../@types';
import { ILogger } from '../../@types/logging';
import { ITaskDefinition, TaskType } from '../../@types/tasks';
import { TYPES } from '../../di/types';
import {
  CistRoomsResponse,
  CistRoom, CistBuilding,
} from '../../@types/cist';
import { QuotaLimiterService } from '../quota-limiter.service';
import { customer } from './constants';
import { FatalError } from './errors';
import { GoogleApiAdminDirectory } from './google-api-admin-directory';
import Schema$CalendarResource = admin_directory_v1.Schema$CalendarResource;
import { GaxiosPromise, GaxiosResponse } from 'gaxios';
import { GoogleUtilsService } from './google-utils.service';

export interface IRoomsTaskContext {
  readonly cistRoomsMap: DeepReadonlyMap<string, ICistRoomData>;
  readonly googleRoomsMap: DeepReadonlyMap<string, Schema$CalendarResource>;
}

export interface ICistRoomData {
  readonly room: DeepReadonly<CistRoom>;
  readonly building: DeepReadonly<CistBuilding>;
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
  async ensureRooms(cistResponse: DeepReadonly<CistRoomsResponse>) {
    const rooms = await this.getAllRooms();

    // tslint:disable-next-line:max-line-length
    const promises: Promise<Nullable<GaxiosResponse<Schema$CalendarResource>>>[] = [];
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
    cistResponse: DeepReadonly<CistRoomsResponse>
  ): Promise<IRoomsTaskContext> {
    return {
      cistRoomsMap: toRoomsWithBuildings(cistResponse)
        .map(([a, b]) => t(this._utils.getRoomId(a, b), {
          room: a,
          building: b
        }))
        .toMap(),
      googleRoomsMap: iterate(await this.getAllRooms())
        .filter(b => typeof b.resourceId === 'string')
        .map(b => t(b.resourceId as string, b))
        .toMap()
    };
  }

  createEnsureRoomsTask(
    cistResponse: DeepReadonly<CistRoomsResponse>
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
      throw new FatalError(`Room ${cistRoomId} is not found in the context`);
    }
    await this.doEnsureRoom(
      cistData.room,
      cistData.building,
      context.googleRoomsMap.get(cistRoomId),
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
  async deleteIrrelevant(cistResponse: DeepReadonly<CistRoomsResponse>) {
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
        .filter(googleRoomId => !context.cistRoomsMap.has(googleRoomId))
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
  async deleteRelevant(cistResponse: DeepReadonly<CistRoomsResponse>) {
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
        this._logger.info(`Loaded ${rooms.length} Google rooms...`);
      }
    } while (roomsPage.data.nextPageToken);
    this._logger.info(`All ${rooms.length} Google rooms loaded!`);
    return rooms;
  }

  private async doEnsureRoom(
    cistRoom: DeepReadonly<CistRoom>,
    cistBuilding: DeepReadonly<CistBuilding>,
    googleRoom: Maybe<DeepReadonly<Schema$CalendarResource>>,
    cistRoomId = this._utils.getRoomId(cistRoom, cistBuilding),
    buildingId = this._utils.getGoogleBuildingId(cistBuilding),
  ) {
    if (googleRoom) {
      const roomPatch = this._utils.cistRoomToGoogleRoomPatch(
        cistRoom,
        googleRoom,
        cistBuilding
      );
      if (roomPatch) {
        return Promise.resolve(this._patch({
          customer,
          calendarResourceId: cistRoomId,
          requestBody: roomPatch,
        })).tap(() => this._logger.info(`Patched room ${cistRoom.short_name}, building ${cistBuilding.short_name}`));
      }
      this._logger.info(`No changes in room ${cistRoom.short_name}, building ${cistBuilding.short_name}`);
      return Promise.resolve(null);
    }
    return Promise.resolve(this._insert({
      customer,
      requestBody: this._utils.cistRoomToInsertGoogleRoom(
        cistRoom,
        cistBuilding,
        buildingId,
        cistRoomId,
      ),
    })).tap(() => this._logger.info(`Inserted room ${cistRoom.short_name}, building ${cistBuilding.short_name}`));
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

function toRoomsWithBuildings(cistResponse: DeepReadonly<CistRoomsResponse>) {
  return iterate(cistResponse.university.buildings)
    .map(b => iterate(b.auditories).map(a => t(a, b)))
    .flatten();
}
