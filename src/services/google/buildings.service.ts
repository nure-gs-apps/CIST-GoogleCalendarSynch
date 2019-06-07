import { admin_directory_v1 } from 'googleapis';
import { inject, injectable } from 'inversify';
import { iterate } from 'iterare';
import { TYPES } from '../../di/types';
import { toTranslit } from '../../utils/translit';
import {
  ApiAuditoriesResponse,
  ApiBuilding,
} from '../cist-json-client.service';
import { logger } from '../logger.service';
import { customer, idPrefix } from './constants';
import { GoogleApiAdmin } from './google-api-admin';
import Schema$Building = admin_directory_v1.Schema$Building;
import Resource$Resources$Buildings = admin_directory_v1.Resource$Resources$Buildings;
import { GaxiosPromise } from 'gaxios';

@injectable()
export class BuildingsService {
  static readonly BUILDING_PAGE_SIZE = 100;
  private readonly _admin: GoogleApiAdmin;

  private _buildings: Resource$Resources$Buildings;

  constructor(@inject(TYPES.GoogleApiAdmin) googleApiAdmin: GoogleApiAdmin) {
    this._admin = googleApiAdmin;
    this._buildings = this._admin.googleAdmin.resources.buildings;
  }

  async ensureBuildings(
    cistResponse: ApiAuditoriesResponse,
  ) {
    const buildings = await this.getAllBuildings();

    const promises = [] as GaxiosPromise<any>[];
    for (const cistBuilding of cistResponse.university.buildings) {
      const googleBuildingId = getGoogleBuildingId(cistBuilding);
      if (buildings.some(b => b.buildingId === googleBuildingId)) {
        logger.debug(`Updating building ${cistBuilding.short_name}`);
        promises.push(
          this._buildings.update({
            customer,
            buildingId: googleBuildingId,
            requestBody: cistBuildingToGoogleBuilding(
              cistBuilding,
              googleBuildingId,
            ),
          }),
        );
      } else {
        logger.debug(`Inserting building ${cistBuilding.short_name}`);
        promises.push(
          this._buildings.insert({
            customer,
            requestBody: cistBuildingToGoogleBuilding(
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
      promises.push(this._buildings.delete({
        customer,
        buildingId: room.buildingId,
      }));
    }
    return Promise.all(promises);
  }

  async deleteIrrelevant(cistResponse: ApiAuditoriesResponse) {
    const buildings = await this.getAllBuildings();
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
    return Promise.all(this.doDeleteByIds(
      buildings,
      iterate(buildings).filter(building => (
        cistResponse.university.buildings.some(
          b => getGoogleBuildingId(b) === building.buildingId,
        )
      )).map(b => b.buildingId!).toSet(),
    ));
  }

  async getAllBuildings() {
    let buildings = [] as admin_directory_v1.Schema$Building[];
    let buildingsPage = null;
    do {
      buildingsPage = await this._buildings.list({
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
      if (ids.has(googleBuilding.buildingId!)) {
        promises.push(
          this._buildings.delete({
            customer,
            buildingId: googleBuilding.buildingId,
          }),
        );
      }
    }
    return promises;
  }
}

function cistBuildingToGoogleBuilding(
  cistBuilding: ApiBuilding,
  id = getGoogleBuildingId(cistBuilding),
): Schema$Building {
  return {
    buildingId: id, // FIXME: maybe exclude for update
    buildingName: cistBuilding.short_name,
    description: cistBuilding.full_name,
    floorNames: Array.from(iterate(cistBuilding.auditories)
      .map(r => transformFloorname(r.floor))
      .toSet()
      .values()),
  };
}

export function getGoogleBuildingId(cistBuilding: ApiBuilding) {
  return `${idPrefix}.${toTranslit(cistBuilding.id)}`;
}

const emptyFloorName = /^\s*$/;
export function transformFloorname(floorName: string) {
  return !emptyFloorName.test(floorName) ? floorName : '_';
}
