// VITALLY IMPORTANT FOR INVERSIFY AS PRECEDING IMPORT
import 'reflect-metadata';
import { decorate, injectable } from 'inversify';

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

  // class tokens
  Config: Symbol.for('Config'),
  CistJsonClient: Symbol.for('CistJsonClient'),

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

export const ASYNC_INIT = Symbol.for('@asyncInit');

const injectables = new Set<any>();
export function ensureInjectable(type: any) {
  if (injectables.has(type)) {
    return;
  }
  decorate(injectable(), type);
  injectables.add(type);
}
