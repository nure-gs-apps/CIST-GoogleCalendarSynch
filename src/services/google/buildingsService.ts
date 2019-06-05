import { inject, injectable } from 'inversify';
import { GoogleApiAdmin } from './google-api-admin';

@injectable()
export class BuildingsService {
  protected readonly _admin: GoogleApiAdmin;

  protected get _buildings() {
    return this._admin.googleAdmin.resources.buildings;
  }

  constructor(@inject(GoogleApiAdmin) googleApiAdmin: GoogleApiAdmin) {
    this._admin = googleApiAdmin;
  }
}
