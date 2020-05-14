import { admin_directory_v1, google } from 'googleapis';
import { inject, injectable } from 'inversify';
import { TYPES } from '../../di/types';
import { IGoogleAuth } from './google-auth';
import Admin = admin_directory_v1.Admin;

@injectable()
export class GoogleApiAdminDirectory {
  private readonly _googleAuth: IGoogleAuth;
  readonly googleAdminDirectory: Admin;

  constructor(@inject(TYPES.GoogleAuthAdminDirectory) googleAuth: IGoogleAuth) {
    this._googleAuth = googleAuth;
    this.googleAdminDirectory = google.admin({
      version: 'directory_v1',
      auth: this._googleAuth.authClient,
    });
  }
}
