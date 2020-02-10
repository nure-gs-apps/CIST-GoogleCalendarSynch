import { getConfig } from '../../config';

export const prependIdPrefix = (() => {
  const idPrefix = getConfig().google.idPrefix; // TODO: move to helper service
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
export const domainName = getConfig().google.auth.subjectEmail.split('@')[1].toLowerCase(); // TODO: move to helper service

export const directoryAuthScopes = [
  'https://www.googleapis.com/auth/admin.directory.resource.calendar',
  'https://www.googleapis.com/auth/admin.directory.group',
] as ReadonlyArray<string>;

export const calenderAuthScopes = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.events',
] as ReadonlyArray<string>;
