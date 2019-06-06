import { admin_directory_v1 } from 'googleapis';
import { inject, injectable } from 'inversify';
import { iterate } from 'iterare';
import { TYPES } from '../../di/types';
import {
  ApiAuditoriesResponse,
  ApiBuilding,
} from '../cist-json-client.service';
import { customer, idPrefix } from './constants';
import { GoogleApiAdmin } from './google-api-admin';
import Schema$Building = admin_directory_v1.Schema$Building;
import Resource$Resources$Buildings = admin_directory_v1.Resource$Resources$Buildings;

@injectable()
export class BuildingsService {
  static readonly BUILDING_PAGE_SIZE = 100;
  private readonly _admin: GoogleApiAdmin;

  private _buildings: Resource$Resources$Buildings;

  constructor(@inject(TYPES.GoogleApiAdmin) googleApiAdmin: GoogleApiAdmin) {
    this._admin = googleApiAdmin;
    this._buildings = this._admin.googleAdmin.resources.buildings;
  }

  async ensureBuildings(cistResponse: ApiAuditoriesResponse) {
    const buildings = await this.loadBuildings();

    const promises = [];
    const processedIds = new Set<string>();
    for (const cistBuilding of cistResponse.university.buildings) {
      const googleBuildingId = getGoogleBuildingId(cistBuilding);
      if (buildings.some(b => b.buildingId === googleBuildingId)) {
        promises.push(
          this._buildings.update({
            customer,
            buildingId: googleBuildingId,
            requestBody: this.cistBuildingToGoogleBuilding(
              cistBuilding,
              googleBuildingId,
            ),
          }),
        );
      } else {
        promises.push(
          this._buildings.insert({
            customer,
            requestBody: this.cistBuildingToGoogleBuilding(
              cistBuilding,
              googleBuildingId,
            ),
          }),
        );
      }
      processedIds.add(googleBuildingId);
    }
    // for (const googleBuilding of buildings) {
    //   if (!processedIds.has(googleBuilding.buildingId!)) {
    //     promises.push(
    //       this._buildings.delete({
    //         customer,
    //         buildingId: googleBuilding.buildingId,
    //       }),
    //     );
    //   }
    // }
    return Promise.all(promises as any);
  }

  private async loadBuildings() {
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

  private cistBuildingToGoogleBuilding(
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
}

export function getGoogleBuildingId(cistBuilding: ApiBuilding) {
  return `${idPrefix}.${cistBuilding.id}`;
}

export function transformFloorname(floorName: string) {
  return floorName ? floorName : '_';
}
