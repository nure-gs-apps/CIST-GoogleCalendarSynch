import { calendar_v3, google } from 'googleapis';
import { inject, injectable } from 'inversify';
import { TYPES } from '../../di/types';
import { IGoogleAuth } from './interfaces';

@injectable()
export class GoogleApiCalendar {
  private readonly _googleAuth: IGoogleAuth;
  readonly googleCalendar: calendar_v3.Calendar;

  constructor(@inject(TYPES.GoogleAuth) googleAuth: IGoogleAuth) {
    this._googleAuth = googleAuth;
    if (!this._googleAuth.authClient) {
      throw new TypeError('Google auth is not initialized');
    }
    this.googleCalendar = google.calendar({
      version: 'v3',
      auth: this._googleAuth.authClient,
    });
  }
}
