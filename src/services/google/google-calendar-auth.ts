import { google } from 'googleapis';
import { inject, injectable } from 'inversify';
import { Nullable } from '../../@types';
import { ASYNC_INIT, TYPES } from '../../di/types';
import { IGoogleAuth } from './interfaces';

@injectable()
export class GoogleCalendarAuth implements IGoogleAuth {
  readonly [ASYNC_INIT]: Promise<any>;
  private _authClient: Nullable<any>;

  get authClient() {
    return this._authClient;
  }

  constructor(
    @inject(TYPES.GoogleAuthCalendarKeyFilepath) keyFilepath: string,
  ) {
    this[ASYNC_INIT] = google.auth.
  }
}
