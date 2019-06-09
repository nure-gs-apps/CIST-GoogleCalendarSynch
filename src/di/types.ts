// VITALLY IMPORTANT FOR INVERSIFY AS PRECEDING IMPORT
import 'reflect-metadata';
import { decorate, injectable } from 'inversify';

export const TYPES = {
  // constants tokens

  CistBaseApi: Symbol.for('CistBaseApi'),
  CistApiKey: Symbol.for('CistApiKey'),
  GoogleAuthDirectoryKeyFilepath: Symbol.for('GoogleAuthDirectoryKeyFilepath'),
  GoogleAuthCalendarKeyFilepath: Symbol.for('GoogleAuthCalendarKeyFilepath'),
  GoogleAuthSubject: Symbol.for('GoogleAuthSubject'),
  GoogleCalendarConfig: Symbol.for('GoogleCalendarConfig'),

  // class tokens
  CistJsonClient: Symbol.for('CistJsonClient'),

  GoogleDirectoryAuth: Symbol.for('GoogleDirectoryAuth'),
  GoogleCalendarAuth: Symbol.for('GoogleCalendarAuth'),
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
