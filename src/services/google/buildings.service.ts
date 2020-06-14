import { GaxiosPromise, GaxiosResponse } from 'gaxios';
import { admin_directory_v1 } from 'googleapis';
import { inject, injectable } from 'inversify';
import { iterate } from 'iterare';
import {
  DeepReadonly,
  DeepReadonlyMap,
  Maybe, Nullable,
  t,
} from '../../@types';
import { CistBuilding, CistRoomsResponse } from '../../@types/cist';
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
import { isEmpty } from 'lodash';

export interface IBuildingsTaskContext {
  readonly cistBuildingsMap: DeepReadonlyMap<string, CistBuilding>;
  readonly googleBuildingsMap: DeepReadonlyMap<string, Schema$Building>;
}

@injectable()
export class BuildingsService {
  static readonly BUILDING_PAGE_SIZE = 500;
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
  }

  /**
   * Doesn't handle errors properly
   */
  async ensureBuildings(cistResponse: DeepReadonly<CistRoomsResponse>) {
    const buildings = await this.getAllBuildings();

    const promises = [] as Promise<any>[];
    for (const cistBuilding of cistResponse.university.buildings) {
      const googleBuildingId = this._utils.getGoogleBuildingId(cistBuilding);
      promises.push(this.doEnsureBuilding(cistBuilding, buildings.find(
        b => b.buildingId === googleBuildingId,
      ), googleBuildingId));
    }
    return Promise.all(promises);
  }

  async createBuildingsContext(
    cistResponse: DeepReadonly<CistRoomsResponse>
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
    cistResponse: DeepReadonly<CistRoomsResponse>
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
      throw new FatalError(`Building ${cistBuildingId} is not found in the context`);
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
  async deleteIrrelevant(cistResponse: DeepReadonly<CistRoomsResponse>) {
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
      steps: iterate(context.googleBuildingsMap.keys())
        .filter(googleBuildingId => !context.cistBuildingsMap.has(
          this._utils.getCistBuildingId(googleBuildingId)
        ))
        .map(id => id as string)
        .toArray(),
    };
  }

  async deleteBuildingById(buildingId: string) {
    return this.doDeleteById(buildingId);
  }

  /**
   * Doesn't handle errors properly
   */
  async deleteRelevant(cistResponse: DeepReadonly<CistRoomsResponse>) {
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
      this._logger.info(`Loaded ${buildings.length} Google buildings...`);
    } while (buildingsPage.data.nextPageToken);
    this._logger.info(`All ${buildings.length} Google buildings loaded!`);
    return buildings;
  }

  private async doEnsureBuilding(
    cistBuilding: DeepReadonly<CistBuilding>,
    googleBuilding: Maybe<DeepReadonly<Schema$Building>>,
    googleBuildingId: string,
  ): Promise<Nullable<GaxiosResponse<Schema$Building>>> {
    if (googleBuilding) {
      const buildingPatch = cistBuildingToGoogleBuildingPatch(
        cistBuilding,
        googleBuilding,
      );
      if (buildingPatch) {
        let floorNames = buildingPatch.floorNames;
        if (
          floorNames
          && googleBuilding.floorNames
          && floorNames.every(f => googleBuilding.floorNames?.includes(f))
        ) {
          delete buildingPatch.floorNames;
        }
        if (isEmpty(buildingPatch)) {
          return Promise.resolve(null);
        }
        const updatedBuilding = await this.patch(
          googleBuildingId,
          buildingPatch,
        );
        if (floorNames && (
          !updatedBuilding.data.floorNames
          || updatedBuilding.data.floorNames.length < floorNames.length
          || !floorNames.every(
            f => updatedBuilding.data.floorNames?.includes(f)
          )
        )) {
          if (updatedBuilding.data.floorNames) {
            floorNames = iterate(floorNames)
              .concat(
                iterate(updatedBuilding.data.floorNames) // FIXME: add only floors with rooms
                  .filter(f => !floorNames?.includes(f))
              ).toArray();
          }
          return this.patch(googleBuildingId, { floorNames }).tap(() => {
            this._logger.info(`Patched building ${cistBuilding.short_name} with relevant and irrelevant floor names`);
          });
        }
        this._logger.info(`Patched building ${cistBuilding.short_name}`);
      } else {
        this._logger.info(`No changes in building ${cistBuilding.short_name}`);
      }
      return Promise.resolve(null);
    }
    return this._insert({
      customer,
      requestBody: this.cistBuildingToInsertGoogleBuilding(
        cistBuilding,
        googleBuildingId,
      ),
    }).tap(() => this._logger.info(`Inserted building ${cistBuilding.short_name}`));
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
    cistBuilding: DeepReadonly<CistBuilding>,
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
    cistResponse: DeepReadonly<CistRoomsResponse>,
  ) {
    return iterate(googleBuildings).filter(building => (
      !cistResponse.university.buildings.some(
        b => this._utils.isSameBuildingIdentity(b, building),
      )
    ))
      .filter(b => typeof b.buildingId === 'string')
      .map(b => b.buildingId as string);
  }

  private patch(id: string, patch: Schema$Building) {
    return this._patch({ // TODO: handle no update for floors
      customer,
      buildingId: id,
      requestBody: patch,
    });
  }
}

function cistBuildingToGoogleBuildingPatch(
  cistBuilding: DeepReadonly<CistBuilding>,
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
