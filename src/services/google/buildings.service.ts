import { GaxiosPromise } from 'gaxios';
import { admin_directory_v1 } from 'googleapis';
import { inject, injectable } from 'inversify';
import { iterate } from 'iterare';
import {
  DeepReadonly,
  DeepReadonlyMap,
  Maybe,
  t,
} from '../../@types';
import { ApiBuilding, ApiRoomsResponse } from '../../@types/cist';
import { ILogger } from '../../@types/logging';
import { ITaskDefinition, TaskType } from '../../@types/tasks';
import { TYPES } from '../../di/types';
import { getFloornamesFromBuilding } from '../../utils/cist';
import { arrayContentEqual } from '../../utils/common';
import { QuotaLimiterService } from '../quota-limiter.service';
import { customer } from './constants';
import { FatalError } from './errors';
import { GoogleApiAdminDirectory } from './google-api-admin-directory';
import { GoogleUtilsService } from './google-utils.service';
import Resource$Resources$Buildings = admin_directory_v1.Resource$Resources$Buildings;
import Schema$Building = admin_directory_v1.Schema$Building;

export interface IBuildingsTaskContext {
  readonly cistBuildingsMap: DeepReadonlyMap<string, ApiBuilding>;
  readonly googleBuildingsMap: DeepReadonlyMap<string, Schema$Building>;
}

@injectable()
export class BuildingsService {
  static readonly BUILDING_PAGE_SIZE = 100;
  private readonly _directory: GoogleApiAdminDirectory;
  private readonly _quotaLimiter: QuotaLimiterService;
  private readonly _utils: GoogleUtilsService;
  private readonly _logger: ILogger;

  private readonly _buildings: Resource$Resources$Buildings;

  private readonly _insert: Resource$Resources$Buildings['insert'];
  private readonly _patch: Resource$Resources$Buildings['patch'];
  private readonly _delete: Resource$Resources$Buildings['delete'];
  private readonly _list: Resource$Resources$Buildings['list'];

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
    this._buildings = this._directory.googleAdminDirectory.resources.buildings;
    this._quotaLimiter = quotaLimiter;

    this._insert = this._quotaLimiter.limiter.wrap(
      this._buildings.insert.bind(this._buildings),
    ) as any;
    this._patch = this._quotaLimiter.limiter.wrap(
      this._buildings.patch.bind(this._buildings),
    ) as any;
    this._delete = this._quotaLimiter.limiter.wrap(
      this._buildings.delete.bind(this._buildings),
    ) as any;
    this._list = this._quotaLimiter.limiter.wrap(
      this._buildings.list.bind(this._buildings),
    ) as any;
    // this._list = this._buildings.list.bind(this._buildings);
  }

  /**
   * Doesn't handle errors properly
   */
  async ensureBuildings(cistResponse: DeepReadonly<ApiRoomsResponse>) {
    const buildings = await this.getAllBuildings();

    const promises = [] as GaxiosPromise[];
    for (const cistBuilding of cistResponse.university.buildings) {
      const googleBuildingId = this._utils.getGoogleBuildingId(cistBuilding);
      promises.push(this.doEnsureBuilding(cistBuilding, buildings.find(
        b => b.buildingId === googleBuildingId,
      ), googleBuildingId));
    }
    return Promise.all(promises);
  }

  async createBuildingsContext(
    cistResponse: DeepReadonly<ApiRoomsResponse>
  ): Promise<IBuildingsTaskContext> {
    return {
      cistBuildingsMap: iterate(cistResponse.university.buildings)
        .map(b => t(b.id, b))
        .toMap(),
      googleBuildingsMap: iterate(await this.getAllBuildings())
        .filter(b => typeof b.buildingId === 'string')
        .map(b => t(b.buildingId as string, b))
        .toMap(),
    };
  }

  createEnsureBuildingsTask(
    cistResponse: DeepReadonly<ApiRoomsResponse>
  ): ITaskDefinition<string> {
    return {
      taskType: TaskType.EnsureBuildings,
      steps: cistResponse.university.buildings.map(b => b.id),
    };
  }

  async ensureBuilding(
    cistBuildingId: string,
    context: IBuildingsTaskContext,
  ) {
    const cistBuilding = context.cistBuildingsMap.get(cistBuildingId);
    if (!cistBuilding) {
      throw new FatalError(`Building ${cistBuildingId} is not found in context`);
    }
    const googleBuildingId = this._utils.getGoogleBuildingId(cistBuilding);
    await this.doEnsureBuilding(
      cistBuilding,
      context.googleBuildingsMap.get(googleBuildingId),
      googleBuildingId,
    );
  }

  /**
   * Doesn't handle errors properly
   */
  async deleteAll() {
    const buildings = await this.getAllBuildings();
    const promises = [];
    for (const room of buildings) {
      promises.push(this._delete({
        customer,
        buildingId: room.buildingId ?? undefined,
      }));
    }
    return Promise.all(promises);
  }

  /**
   * Doesn't handle errors properly
   */
  async deleteIrrelevant(cistResponse: DeepReadonly<ApiRoomsResponse>) {
    const buildings = await this.getAllBuildings();
    return Promise.all(this.doDeleteByIds(
      buildings,
      this.getIrrelevantBuildingGoogleIds(buildings, cistResponse).toSet(),
    ));
  }

  createDeleteIrrelevantTask(
    context: IBuildingsTaskContext
  ): ITaskDefinition<string> {
    return {
      taskType: TaskType.DeleteIrrelevantBuildings,
      steps: iterate(context.cistBuildingsMap.values())
        .map(cistBuilding => this._utils.getGoogleBuildingId(cistBuilding))
        .filter(
          googleBuildingId => context.googleBuildingsMap.has(googleBuildingId)
        )
        .toArray(),
    };
  }

  async deleteBuildingById(buildingId: string) {
    return this.doDeleteById(buildingId);
  }

  /**
   * Doesn't handle errors properly
   */
  async deleteRelevant(cistResponse: DeepReadonly<ApiRoomsResponse>) {
    const buildings = await this.getAllBuildings();
    return Promise.all(this.doDeleteByIds(
      buildings,
      iterate(buildings).filter(building => (
        cistResponse.university.buildings.some(
          b => this._utils.isSameBuildingIdentity(b, building),
        )
      ))
        .filter(b => typeof b.buildingId === 'string')
        .map(b => b.buildingId as string)
        .toSet(),
    ));
  }

  async getAllBuildings() {
    let buildings = [] as admin_directory_v1.Schema$Building[];
    let buildingsPage = null;
    do {
      buildingsPage = await this._list({
        customer,
        maxResults: BuildingsService.BUILDING_PAGE_SIZE,
        nextPage: buildingsPage ? buildingsPage.data.nextPageToken : null,
      } as admin_directory_v1.Params$Resource$Resources$Buildings$List);
      if (buildingsPage.data.buildings) {
        buildings = buildings.concat(buildingsPage.data.buildings);
      }
    } while (buildingsPage.data.nextPageToken);
    return buildings;
  }

  private doEnsureBuilding(
    cistBuilding: DeepReadonly<ApiBuilding>,
    googleBuilding: Maybe<DeepReadonly<Schema$Building>>,
    googleBuildingId: string,
  ) {
    if (googleBuilding) {
      const buildingPatch = cistBuildingToGoogleBuildingPatch(
        cistBuilding,
        googleBuilding,
      );
      if (buildingPatch) {
        this._logger.info(`Patching building ${cistBuilding.short_name}`);
        return this._patch({
          customer,
          buildingId: googleBuildingId,
          requestBody: buildingPatch,
        });
      }
    }
    this._logger.info(`Inserting building ${cistBuilding.short_name}`);
    return this._insert({
      customer,
      requestBody: this.cistBuildingToInsertGoogleBuilding(
        cistBuilding,
        googleBuildingId,
      ),
    });
  }

  private doDeleteByIds(
    buildings: Iterable<DeepReadonly<Schema$Building>>,
    ids: Set<string>,
    promises = [] as GaxiosPromise<void>[],
  ) {
    for (const googleBuilding of buildings) {
      if (googleBuilding.buildingId && ids.has(googleBuilding.buildingId)) {
        promises.push(this.doDeleteById(googleBuilding.buildingId));
      }
    }
    return promises;
  }

  private doDeleteById(buildingId: string) {
    return this._delete({
      customer,
      buildingId,
    });
  }

  private cistBuildingToInsertGoogleBuilding(
    cistBuilding: DeepReadonly<ApiBuilding>,
    id = this._utils.getGoogleBuildingId(cistBuilding),
  ): Schema$Building {
    return {
      buildingId: id,
      buildingName: cistBuilding.short_name,
      description: cistBuilding.full_name,
      floorNames: getFloornamesFromBuilding(cistBuilding),
    };
  }

  private getIrrelevantBuildingGoogleIds(
    googleBuildings: Iterable<DeepReadonly<Schema$Building>>,
    cistResponse: DeepReadonly<ApiRoomsResponse>,
  ) {
    return iterate(googleBuildings).filter(building => (
      !cistResponse.university.buildings.some(
        b => this._utils.isSameBuildingIdentity(b, building),
      )
    ))
      .filter(b => typeof b.buildingId === 'string')
      .map(b => b.buildingId as string);
  }
}

function cistBuildingToGoogleBuildingPatch(
  cistBuilding: DeepReadonly<ApiBuilding>,
  googleBuilding: DeepReadonly<Schema$Building>,
) {
  let hasChanges = false;
  const buildingPatch = {} as Schema$Building;
  if (cistBuilding.short_name !== googleBuilding.buildingName) {
    buildingPatch.buildingName = cistBuilding.short_name;
    hasChanges = true;
  }
  if (cistBuilding.full_name !== googleBuilding.description) {
    buildingPatch.description = cistBuilding.full_name;
    hasChanges = true;
  }
  const floorNames = getFloornamesFromBuilding(cistBuilding);
  if (googleBuilding.floorNames && !arrayContentEqual(
    googleBuilding.floorNames,
    floorNames,
  )) {
    buildingPatch.floorNames = floorNames;
    hasChanges = true;
  }
  return hasChanges ? buildingPatch : null;
}
