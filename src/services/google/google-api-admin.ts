import { admin_directory_v1, google } from 'googleapis';
import { inject, injectable } from 'inversify';
import { GoogleAuth } from './google-auth';
import Admin = admin_directory_v1.Admin;

@injectable()
export class GoogleApiAdmin {
  protected readonly _googleAuth: GoogleAuth;
  readonly googleAdmin: Admin;

  constructor(@inject(GoogleAuth) googleAuth: GoogleAuth) {
    this._googleAuth = googleAuth;
    if (!this._googleAuth.authClient) {
      throw new TypeError('Google auth is not initialized');
    }
    this.googleAdmin = google.admin({
      auth: this._googleAuth.authClient,

    } as any) as any;
  }
}
