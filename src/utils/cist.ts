import { iterate } from 'iterare';
import { DeepReadonly } from '../@types';
import { CacheType, CistCacheConfig } from '../config/types';
import { ApiBuilding } from '../services/cist/types';
import { transformFloorname } from '../services/google/google-utils.service';

export function getFloornamesFromBuilding(building: ApiBuilding) {
  return Array.from(iterate(building.auditories)
    .map(r => transformFloorname(r.floor))
    .toSet()
    .values());
}

export function includesCache(
  config: DeepReadonly<CistCacheConfig>,
  type: CacheType,
) {
  return config.priorities.auditories.includes(type)
    || config.priorities.events.includes(type)
    || config.priorities.groups.includes(type);
}
