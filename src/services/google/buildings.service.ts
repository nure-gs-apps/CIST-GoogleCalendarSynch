import { GaxiosPromise } from 'gaxios';
import { admin_directory_v1 } from 'googleapis';
import { inject, injectable } from 'inversify';
import { iterate } from 'iterare';
import { TYPES } from '../../di/types';
import { getFloornamesFromBuilding } from '../../utils/cist';
import { arrayContentEqual } from '../../utils/common';
import {
  ApiRoomsResponse,
  ApiBuilding,
} from '../../@types/cist';
import { logger } from '../logger.service';
import { QuotaLimiterService } from '../quota-limiter.service';
import { customer } from './constants';
import { GoogleApiAdminDirectory } from './google-api-admin-directory';
import { GoogleUtilsService } from './google-utils.service';
import Resource$Resources$Buildings = admin_directory_v1.Resource$Resources$Buildings;
import Schema$Building = admin_directory_v1.Schema$Building;

@injectable()
export class BuildingsService {
  static readonly BUILDING_PAGE_SIZE = 100;
  private readonly _utils: GoogleUtilsService;
  private readonly _directory: GoogleApiAdminDirectory;
  private readonly _quotaLimiter: QuotaLimiterService;

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
  ) {
    this._utils = utils;

    this._directory = googleApiAdminDirectory;
    this._buildings = this._directory.googleDirectory.resources.buildings;
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

  async ensureBuildings(
    cistResponse: ApiRoomsResponse,
  ) {
    const buildings = await this.getAllBuildings();

    const promises = [] as GaxiosPromise<any>[];
    for (const cistBuilding of cistResponse.university.buildings) {
      const googleBuildingId = this._utils.getGoogleBuildingId(cistBuilding);
      const googleBuilding = buildings.find(
        b => b.buildingId === googleBuildingId,
      );
      if (googleBuilding) {
        const buildingPatch = cistBuildingToGoogleBuildingPatch(
          cistBuilding,
          googleBuilding,
        );
        if (buildingPatch) {
          logger.debug(`Patching building ${cistBuilding.short_name}`);
          promises.push(
            this._patch({
              customer,
              buildingId: googleBuildingId,
              requestBody: buildingPatch,
            }),
          );
        }
      } else {
        logger.debug(`Inserting building ${cistBuilding.short_name}`);
        promises.push(
          this._insert({
            customer,
            requestBody: this.cistBuildingToInsertGoogleBuilding(
              cistBuilding,
              googleBuildingId,
            ),
          }),
        );
      }
    }
    return Promise.all(promises as any);
  }

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

  async deleteIrrelevant(cistResponse: ApiRoomsResponse) {
    const buildings = await this.getAllBuildings();
    return Promise.all(this.doDeleteByIds(
      buildings,
      iterate(buildings).filter(building => (
        !cistResponse.university.buildings.some(
          b => this._utils.isSameBuildingIdentity(b, building),
        )
        // tslint:disable-next-line:no-non-null-assertion
      )).map(b => b.buildingId!).toSet(),
    ));
  }

  async deleteRelevant(cistResponse: ApiRoomsResponse) {
    const buildings = await this.getAllBuildings();
    return Promise.all(this.doDeleteByIds(
      buildings,
      iterate(buildings).filter(building => (
        cistResponse.university.buildings.some(
          b => this._utils.isSameBuildingIdentity(b, building),
        )
        // tslint:disable-next-line:no-non-null-assertion
      )).map(b => b.buildingId!).toSet(),
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

  private doDeleteByIds(
    buildings: Schema$Building[],
    ids: Set<string>,
    promises = [] as GaxiosPromise<void>[],
  ) {
    for (const googleBuilding of buildings) {
      // tslint:disable-next-line:no-non-null-assertion
      if (ids.has(googleBuilding.buildingId!)) {
        promises.push(
          this._delete({
            customer,
            buildingId: googleBuilding.buildingId ?? undefined,
          }),
        );
      }
    }
    return promises;
  }

  private cistBuildingToInsertGoogleBuilding(
    cistBuilding: ApiBuilding,
    id = this._utils.getGoogleBuildingId(cistBuilding),
  ): Schema$Building {
    return {
      buildingId: id,
      buildingName: cistBuilding.short_name,
      description: cistBuilding.full_name,
      floorNames: getFloornamesFromBuilding(cistBuilding),
    };
  }
}

function cistBuildingToGoogleBuildingPatch(
  cistBuilding: ApiBuilding,
  googleBuilding: Schema$Building,
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
  // tslint:disable-next-line:no-non-null-assertion
  if (!arrayContentEqual(googleBuilding.floorNames!, floorNames)) {
    buildingPatch.floorNames = floorNames;
    hasChanges = true;
  }
  return hasChanges ? buildingPatch : null;
}
