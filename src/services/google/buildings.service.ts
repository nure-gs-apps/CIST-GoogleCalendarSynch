import { admin_directory_v1 } from 'googleapis';
import { inject, injectable } from 'inversify';
import { iterate } from 'iterare';
import { Nullable } from '../../@types';
import { TYPES } from '../../di/types';
import { arrayContentEqual, toBase64 } from '../../utils/common';
import { toTranslit } from '../../utils/translit';
import {
  ApiAuditoriesResponse,
  ApiBuilding,
} from '../cist-json-client.service';
import { logger } from '../logger.service';
import { QuotaLimiterService } from '../quota-limiter.service';
import { customer, prependIdPrefix } from './constants';
import { GoogleApiDirectory } from './google-api-directory';
import Schema$Building = admin_directory_v1.Schema$Building;
import Resource$Resources$Buildings = admin_directory_v1.Resource$Resources$Buildings;
import { GaxiosPromise } from 'gaxios';

@injectable()
export class BuildingsService {
  static readonly BUILDING_PAGE_SIZE = 100;
  private readonly _directory: GoogleApiDirectory;
  private readonly _quotaLimiter: QuotaLimiterService;

  private readonly _buildings: Resource$Resources$Buildings;

  private readonly _insert: Resource$Resources$Buildings['insert'];
  private readonly _patch: Resource$Resources$Buildings['patch'];
  private readonly _delete: Resource$Resources$Buildings['delete'];
  private readonly _list: Resource$Resources$Buildings['list'];

  private _cachedBuildings: Nullable<Schema$Building[]>;
  private _cacheLastUpdate: Nullable<Date>;

  get cachedBuildings() {
    return this._cachedBuildings as Nullable<ReadonlyArray<Schema$Building>>;
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
  ) {
    this._directory = googleApiDirectory;
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

    this._cachedBuildings = null;
    this._cacheLastUpdate = null;
  }

  async ensureBuildings(
    cistResponse: ApiAuditoriesResponse,
  ) {
    const buildings = await this.getAllBuildings();

    const promises = [] as GaxiosPromise<any>[];
    for (const cistBuilding of cistResponse.university.buildings) {
      const googleBuildingId = getGoogleBuildingId(cistBuilding);
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
            requestBody: cistBuildingToInsertGoogleBuilding(
              cistBuilding,
              googleBuildingId,
            ),
          }),
        );
      }
    }
    this.clearCache();
    return Promise.all(promises as any);
  }

  async deleteAll() {
    const buildings = await this.getAllBuildings();
    const promises = [];
    for (const room of buildings) {
      promises.push(this._delete({
        customer,
        buildingId: room.buildingId,
      }));
    }
    this.clearCache();
    return Promise.all(promises);
  }

  async deleteIrrelevant(cistResponse: ApiAuditoriesResponse) {
    const buildings = await this.getAllBuildings();
    this.clearCache();
    return Promise.all(this.doDeleteByIds(
      buildings,
      iterate(buildings).filter(building => (
        !cistResponse.university.buildings.some(
          b => getGoogleBuildingId(b) === building.buildingId,
        )
      )).map(b => b.buildingId!).toSet(),
    ));
  }

  async deleteRelevant(cistResponse: ApiAuditoriesResponse) {
    const buildings = await this.getAllBuildings();
    this.clearCache();
    return Promise.all(this.doDeleteByIds(
      buildings,
      iterate(buildings).filter(building => (
        cistResponse.university.buildings.some(
          b => getGoogleBuildingId(b) === building.buildingId,
        )
      )).map(b => b.buildingId!).toSet(),
    ));
  }

  async getAllBuildings(cacheResults = false) {
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
    if (cacheResults) {
      this._cachedBuildings = buildings;
      this._cacheLastUpdate = new Date();
    }
    return buildings;
  }

  clearCache() {
    this._cachedBuildings = null;
    this._cacheLastUpdate = null;
  }

  private doDeleteByIds(
    buildings: Schema$Building[],
    ids: Set<string>,
    promises = [] as GaxiosPromise<void>[],
  ) {
    for (const googleBuilding of buildings) {
      if (ids.has(googleBuilding.buildingId!)) {
        promises.push(
          this._delete({
            customer,
            buildingId: googleBuilding.buildingId,
          }),
        );
      }
    }
    return promises;
  }
}

function cistBuildingToInsertGoogleBuilding(
  cistBuilding: ApiBuilding,
  id = getGoogleBuildingId(cistBuilding),
): Schema$Building {
  return {
    buildingId: id,
    buildingName: cistBuilding.short_name,
    description: cistBuilding.full_name,
    floorNames: getFloornamesFromBuilding(cistBuilding),
  };
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
  if (!arrayContentEqual(googleBuilding.floorNames!, floorNames)) {
    buildingPatch.floorNames = floorNames;
    hasChanges = true;
  }
  return hasChanges ? buildingPatch : null;
}

// FIXME: maybe move to other place
function getFloornamesFromBuilding(building: ApiBuilding) {
  return Array.from(iterate(building.auditories)
    .map(r => transformFloorname(r.floor))
    .toSet()
    .values());
}

export const buildingIdPrefix = 'b';
export function getGoogleBuildingId(cistBuilding: ApiBuilding) {
  return prependIdPrefix(`${buildingIdPrefix}.${toBase64(cistBuilding.id)}`);
}

const emptyFloorName = /^\s*$/;
export function transformFloorname(floorName: string) {
  return !emptyFloorName.test(floorName) ? floorName : '_';
}
