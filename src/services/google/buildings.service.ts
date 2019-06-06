import { admin_directory_v1 } from 'googleapis';
import { inject, injectable } from 'inversify';
import { iterate } from 'iterare';
import { TYPES } from '../../di/types';
import {
  ApiAuditoriesResponse,
  ApiBuilding,
} from '../cist-json-client.service';
import { GoogleApiAdmin } from './google-api-admin';
import Schema$Building = admin_directory_v1.Schema$Building;

@injectable()
export class BuildingsService {
  static readonly BUILDING_PAGE_SIZE = 100;
  protected readonly _admin: GoogleApiAdmin;

  protected get _buildings() {
    return this._admin.googleAdmin.resources.buildings;
  }

  constructor(@inject(TYPES.GoogleApiAdmin) googleApiAdmin: GoogleApiAdmin) {
    this._admin = googleApiAdmin;
  }

  async ensureBuildings(cistResponse: ApiAuditoriesResponse) {
    const buildings = await this.loadBuildings();

    const promises = [];
    const processedIds = new Set<string>();
    for (const cistBuilding of cistResponse.university.buildings) {
      if (buildings.some(b => b.buildingId === cistBuilding.id)) {
        promises.push(
          this._buildings.update({
            buildingId: cistBuilding.id,
            requestBody: this.cistBuildingToGoogleBuilding(cistBuilding),
          }),
        );
      } else {
        promises.push(
          this._buildings.insert({
            requestBody: this.cistBuildingToGoogleBuilding(cistBuilding),
          }),
        );
      }
      processedIds.add(cistBuilding.id);
    }
    for (const googleBuilding of buildings) {
      if (!processedIds.has(googleBuilding.buildingId!)) {
        promises.push(
          this._buildings.delete({
            buildingId: googleBuilding.buildingId,
          }),
        );
      }
    }
    return promises;
  }

  protected async loadBuildings() {
    let buildings = [] as admin_directory_v1.Schema$Building[];
    let buildingsPage = null;
    do {
      buildingsPage = await this._buildings.list({
        customer: 'my_customer', // FIXME: move to config or clarify
        maxResults: BuildingsService.BUILDING_PAGE_SIZE,
        nextPage: buildingsPage ? buildingsPage.data.nextPageToken : null,
      } as admin_directory_v1.Params$Resource$Resources$Buildings$List);
      if (buildingsPage.data.buildings) {
        buildings = buildings.concat(buildingsPage.data.buildings);
      }
    } while (buildingsPage.data.nextPageToken);
    return buildings;
  }

  protected cistBuildingToGoogleBuilding(
    cistBuilding: ApiBuilding,
  ): Schema$Building {
    return {
      buildingId: cistBuilding.id,
      buildingName: cistBuilding.short_name,
      description: cistBuilding.full_name,
      floorNames: Array.from(new Set(
        iterate(cistBuilding.auditories).map(r => r.floor),
      ).values()),
    };
  }
}