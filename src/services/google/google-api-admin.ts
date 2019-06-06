import { admin_directory_v1, google } from 'googleapis';
import { inject, injectable } from 'inversify';
import { TYPES } from '../../di/types';
import { GoogleAuth } from './google-auth';
import Admin = admin_directory_v1.Admin;

@injectable()
export class GoogleApiAdmin {
  private readonly _googleAuth: GoogleAuth;
  readonly googleAdmin: Admin;

  constructor(@inject(TYPES.GoogleAuth) googleAuth: GoogleAuth) {
    this._googleAuth = googleAuth;
    if (!this._googleAuth.authClient) {
      throw new TypeError('Google auth is not initialized');
    }
    this.googleAdmin = google.admin({
      version: 'directory_v1',
      auth: this._googleAuth.authClient as any,
    });
  }
}
