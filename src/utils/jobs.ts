import { interfaces } from 'inversify';
import { DeepReadonly } from '../@types';
import { IEntitiesToOperateOn } from '../@types/jobs';
import { AppConfig, CacheType } from '../config/types';
import { CachedCistJsonClientService } from '../services/cist/cached-cist-json-client.service';
import { CistJsonHttpClient } from '../services/cist/cist-json-http-client.service';
import ServiceIdentifier = interfaces.ServiceIdentifier;

export function getCistCachedClientTypes(
  operateOn: DeepReadonly<IEntitiesToOperateOn>,
  cachePriorities: DeepReadonly<AppConfig['caching']['cist']['priorities']>,
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
