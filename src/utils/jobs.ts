import { interfaces } from 'inversify';
import { DeepReadonly } from '../@types';
import { IEntitiesToOperateOn } from '../@types/jobs';
import { AppConfig, CacheType } from '../config/types';
import { CachedCistJsonClientService } from '../services/cist/cached-cist-json-client.service';
import { CistJsonHttpClient } from '../services/cist/cist-json-http-client.service';
import ServiceIdentifier = interfaces.ServiceIdentifier;
import moment = require('moment');

export type Priorities = DeepReadonly<AppConfig['caching']['cist']['priorities']>;

export function getCistCachedClientTypesForArgs(
  operateOn: DeepReadonly<IEntitiesToOperateOn>,
  cachePriorities: Priorities,
) {
  const types: ServiceIdentifier<any>[] = [CachedCistJsonClientService];
  if ((
      operateOn.groups
      && cachePriorities.groups.includes(CacheType.Http)
    )
    || (
      operateOn.auditories
      && cachePriorities.auditories.includes(CacheType.Http)
    )
    || (
      operateOn.events
      && cachePriorities.events.includes(CacheType.Http)
    )) {
    types.push(CistJsonHttpClient);
  }
  return types;
}

export function getCistCachedClientTypes(
  cachePriorities: Priorities
): ServiceIdentifier<any>[] {
  const types: ServiceIdentifier<any>[] = [CachedCistJsonClientService];
  if (
    cachePriorities.groups.includes(CacheType.Http)
    || cachePriorities.auditories.includes(CacheType.Http)
    || cachePriorities.events.includes(CacheType.Http)
  ) {
    types.push(CistJsonHttpClient);
  }
  return types;
}

export function toDeadlineDate(duration: moment.Duration) {
  return new Date(Date.now() + duration.asMilliseconds());
}
