// VITALLY IMPORTANT FOR INVERSIFY AS PRECEDING IMPORT
import { decorate, injectable } from 'inversify';
import 'reflect-metadata';

export const TYPES = {
  // constants tokens

  CistBaseApiUrl: Symbol.for('CistBaseApiUrl'),
  CistApiKey: Symbol.for('CistApiKey'),
  GoogleAuthAdminDirectoryKey: Symbol.for('GoogleAuthAdminDirectoryKey'),
  GoogleAuthKeyFilepath: Symbol.for('GoogleAuthKeyFilepath'),
  GoogleAuthCalendarKeyFilepath: Symbol.for('GoogleAuthCalendarKeyFilepath'),
  GoogleAuthSubject: Symbol.for('GoogleAuthSubject'),
  GoogleAuthScopes: Symbol.for('GoogleAuthScopes'),
  GoogleCalendarConfig: Symbol.for('GoogleCalendarConfig'),

  CacheMaxExpiration: Symbol.for('CacheMaxExpiration'),

  CistCacheConfig: Symbol.for('CistCacheConfig'),

  // class tokens
  Config: Symbol.for('Config'),
  Logger: Symbol.for('Logger'),

  CistJsonHttpClient: Symbol.for('CistJsonHttpClient'),
  CistJsonClient: Symbol.for('CistJsonClient'),
  CistJsonHttpParser: Symbol.for('CistJsonHttpParser'),

  CacheUtils: Symbol.for('CacheUtils'),

  GoogleAuth: Symbol.for('GoogleAuth'),
  GoogleUtils: Symbol.for('GoogleUtils'),
  GoogleAdminDirectoryQuotaLimiter: Symbol.for('GoogleAdminDirectoryQuotaLimiter'),
  GoogleCalendarQuotaLimiter: Symbol.for('GoogleCalendarQuotaLimiter'),
  GoogleApiAdminDirectory: Symbol.for('GoogleApiAdminDirectory'),
  GoogleApiCalendar: Symbol.for('GoogleApiCalendar'),

  BuildingsService: Symbol.for('BuildingsService'),
  RoomsService: Symbol.for('RoomsService'),
  GroupsService: Symbol.for('GroupsService'),

  CalendarService: Symbol.for('CalendarService'),
  EventsService: Symbol.for('EventsService'),
};

export enum ContainerType {
  FULL, CIST_JSON_ONLY,
}

const injectables = new Set<any>();
export function ensureInjectable(type: any) {
  if (injectables.has(type)) {
    return;
  }
  decorate(injectable(), type);
  injectables.add(type);
}
