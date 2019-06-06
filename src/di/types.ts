// VITALLY IMPORTANT FOR INVERSIFY AS PRECEDING IMPORT
import 'reflect-metadata';
import { decorate, injectable } from 'inversify';

export const TYPES = {
  CistJsonClient: Symbol.for('CistJsonClient'),

  GoogleAuth: Symbol.for('GoogleAuth'),
  GoogleApiAdmin: Symbol.for('GoogleApiAdmin'),
  GoogleApiCalendar: Symbol.for('GoogleApiCalendar'),

  BuildingsService: Symbol.for('BuildingsService'),
  RoomsService: Symbol.for('RoomsService'),
};

export const ASYNC_INIT = Symbol.for('@asyncInit');

const injectables = new Set<any>();
export function ensureInjectable(type: any) {
  if (injectables.has(type)) {
    return;
  }
  decorate(injectable(), type);
  injectables.add(type);
}
