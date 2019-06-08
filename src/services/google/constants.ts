import * as config from 'config';
import { IConfig } from '../../@types';

export const idPrefix = config.get<IConfig['google']['idPrefix']>(
  'google.idPrefix',
) || 'cist';
if (!/^\w*$/.test(idPrefix)) {
  throw new TypeError('idPrefix must be a alphanumeral string');
}
export const customer = 'my_customer';
export const domainName = config.get<IConfig['google']['auth']['subjectEmail']>(
  'google.auth.subjectEmail',
).split('@')[1].toLowerCase();

export const directoryAuthScopes = [
  'https://www.googleapis.com/auth/admin.directory.resource.calendar',
  'https://www.googleapis.com/auth/admin.directory.group',
] as ReadonlyArray<string>;

export const calenderAuthScopes = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.events',
] as ReadonlyArray<string>;
