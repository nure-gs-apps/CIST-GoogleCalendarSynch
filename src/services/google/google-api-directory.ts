import { admin_directory_v1, google } from 'googleapis';
import { inject, injectable } from 'inversify';
import { TYPES } from '../../di/types';
import { IGoogleAuth } from './interfaces';
import Admin = admin_directory_v1.Admin;

@injectable()
export class GoogleApiDirectory {
  private readonly _googleAuth: IGoogleAuth;
  readonly googleDirectory: Admin;

  constructor(@inject(TYPES.GoogleAuth) googleAuth: IGoogleAuth) {
    this._googleAuth = googleAuth;
    if (!this._googleAuth.authClient) {
      throw new TypeError('Google auth is not initialized');
    }
    this.googleDirectory = google.admin({
      version: 'directory_v1',
      auth: this._googleAuth.authClient,
    });
  }
}
