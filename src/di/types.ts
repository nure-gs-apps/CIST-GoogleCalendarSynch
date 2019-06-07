// VITALLY IMPORTANT FOR INVERSIFY AS PRECEDING IMPORT
import 'reflect-metadata';
import { decorate, injectable } from 'inversify';

export const TYPES = {
  // constants tokens

  CistBaseApi: Symbol.for('CistBaseApi'),
  CistApiKey: Symbol.for('CistApiKey'),
  GoogleAuthAdminKeyFilepath: Symbol.for('GoogleAuthAdminKeyFilepath'),
  GoogleAuthCalendarKeyFilepath: Symbol.for('GoogleAuthCalendarKeyFilepath'),
  GoogleAuthSubject: Symbol.for('GoogleAuthSubject'),

  // class tokens
  CistJsonClient: Symbol.for('CistJsonClient'),

  GoogleAdminAuth: Symbol.for('GoogleAdminAuth'),
  GoogleCalendarAuth: Symbol.for('GoogleCalendarAuth'),
  GoogleApiAdmin: Symbol.for('GoogleApiAdmin'),
  GoogleApiCalendar: Symbol.for('GoogleApiCalendar'),

  BuildingsService: Symbol.for('BuildingsService'),
  RoomsService: Symbol.for('RoomsService'),
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
