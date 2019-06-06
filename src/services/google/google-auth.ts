import { injectable } from 'inversify';
import { google } from 'googleapis';
import { Nullable } from '../../@types';
import { ASYNC_INIT } from '../../di/types';
import { logger } from '../logger.service';

@injectable()
export class GoogleAuth {
  readonly [ASYNC_INIT]: Promise<unknown>;
  private _authClient: Nullable<unknown>;

  get authClient() {
    return this._authClient;
  }

  constructor() {
    this[ASYNC_INIT] = google.auth.getClient() as Promise<any>;
    this._authClient = null;
    this[ASYNC_INIT]
      .then(authClient => this._authClient = authClient);
  }
}
