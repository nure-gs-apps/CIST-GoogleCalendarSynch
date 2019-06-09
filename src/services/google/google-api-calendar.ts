import { injectable } from 'inversify';
import { IGoogleAuth } from './interfaces';

@injectable()
export class GoogleApiCalendar {
  private readonly _googleAuth: IGoogleAuth;
}
