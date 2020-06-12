// VITALLY IMPORTANT FOR INVERSIFY AS PRECEDING IMPORT
import { decorate, injectable, interfaces } from 'inversify';
import 'reflect-metadata';

export const TYPES = {
  // constants tokens
  TaskProgressFileBackendFileName: Symbol.for('TaskProgressFileBackendFileName'),
  TaskProgressBackendType: Symbol.for('TaskProgressBackendType'),

  NureAddress: Symbol.for('NureAddress'),
  CistBaseApiUrl: Symbol.for('CistBaseApiUrl'),
  CistApiKey: Symbol.for('CistApiKey'),
  GoogleAuthAdminDirectoryKey: Symbol.for('GoogleAuthAdminDirectoryKey'),
  GoogleAuthCalendarKey: Symbol.for('GoogleAuthCalendarKey'),
  GoogleAdminDirectoryQuotaLimiterConfig: Symbol.for('GoogleAdminDirectoryQuotaLimiterConfig'),
  GoogleCalendarQuotaLimiterConfig: Symbol.for('GoogleCalendarQuotaLimiterConfig'),
  GoogleAuthSubject: Symbol.for('GoogleAuthSubject'),
  GoogleEntityIdPrefix: Symbol.for('GoogleEntityIdPrefix'),
  GoogleGroupEmailPrefix: Symbol.for('GoogleGroupEmailPrefix'),
  GoogleCalendarConfig: Symbol.for('GoogleCalendarConfig'),

  CacheMaxExpiration: Symbol.for('CacheMaxExpiration'),

  CistCacheConfig: Symbol.for('CistCacheConfig'),

  // class tokens
  Config: Symbol.for('Config'),
  Logger: Symbol.for('Logger'),
  Container: Symbol.for('Container'),

  TaskStepExecutor: Symbol.for('TaskStepExecutor'),

  TaskProgressBackend: Symbol.for('TaskProgressBackend'),
  TaskProgressFileBackend: Symbol.for('TaskProgressFileBackend'),

  CistJsonHttpClient: Symbol.for('CistJsonHttpClient'),
  CistJsonClient: Symbol.for('CistJsonClient'),
  CistJsonHttpParser: Symbol.for('CistJsonHttpParser'),

  CacheUtils: Symbol.for('CacheUtils'),

  GoogleAuthAdminDirectory: Symbol.for('GoogleAuthAdminDirectory'),
  GoogleAuthCalendar: Symbol.for('GoogleAuthCalendar'),
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

const injectables = new Set<any>();
export function ensureInjectable(type: any) {
  if (injectables.has(type)) {
    return;
  }
  decorate(injectable(), type);
  injectables.add(type);
}

export interface IContainer {
  get<T>(serviceIdentifier: interfaces.ServiceIdentifier<T>): T;
}
