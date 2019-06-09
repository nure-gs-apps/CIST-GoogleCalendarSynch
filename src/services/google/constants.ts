import * as config from 'config';
import { IConfig } from '../../@types';

export const prependIdPrefix = (() => {
  const idPrefix = config.get<IConfig['google']['idPrefix']>(
    'google.idPrefix',
  );
  const prefixIsValid = idPrefix === null || (
    typeof idPrefix === 'string'
    && /^\w+$/.test(idPrefix)
  );
  if (!prefixIsValid) {
    throw new TypeError('idPrefix must be a alphanumeral string or null to omit');
  }
  return prefixIsValid
    ? (id: string) => `${idPrefix}.${id}`
    : (id: string) => id;
})();

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
