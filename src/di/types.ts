// VITALLY IMPORTANT FOR INVERSIFY AS PRECEDING IMPORT
import { decorate, injectable } from 'inversify';
import 'reflect-metadata';

export const TYPES = {
  // constants tokens

  CistBaseApi: Symbol.for('CistBaseApi'),
  CistApiKey: Symbol.for('CistApiKey'),
  GoogleAuthKeyFilepath: Symbol.for('GoogleAuthKeyFilepath'),
  GoogleAuthCalendarKeyFilepath: Symbol.for('GoogleAuthCalendarKeyFilepath'),
  GoogleAuthSubject: Symbol.for('GoogleAuthSubject'),
  GoogleAuthScopes: Symbol.for('GoogleAuthScopes'),
  GoogleCalendarConfig: Symbol.for('GoogleCalendarConfig'),

  CacheMaxExpiration: Symbol.for('CacheMaxExpiration'),

  CistCacheConfig: Symbol.for('CistCacheConfig'),

  // class tokens
  Config: Symbol.for('Config'),
  CistJsonHttpClient: Symbol.for('CistJsonHttpClient'),
  CistJsonClient: Symbol.for('CistJsonClient'),
  CistJsonHttpUtils: Symbol.for('CistJsonHttpUtils'),

  CacheUtils: Symbol.for('CacheUtils'),

  GoogleAuth: Symbol.for('GoogleAuth'),
  GoogleUtils: Symbol.for('GoogleUtils'),
  GoogleDirectoryQuotaLimiter: Symbol.for('GoogleDirectoryQuotaLimiter'),
  GoogleCalendarQuotaLimiter: Symbol.for('GoogleCalendarQuotaLimiter'),
  GoogleApiDirectory: Symbol.for('GoogleApiDirectory'),
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
