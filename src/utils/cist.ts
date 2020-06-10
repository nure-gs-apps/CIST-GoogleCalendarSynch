import iterate from 'iterare';
import { DeepReadonly, t } from '../@types';
import { CistBuilding, CistGroupsResponse } from '../@types/cist';
import { CacheType, CistCacheConfig } from '../config/types';
import { transformFloorName } from '../services/google/google-utils.service';

export function getFloornamesFromBuilding(
  building: DeepReadonly<CistBuilding>
) {
  return Array.from(iterate(building.auditories)
    .map(r => transformFloorName(r.floor))
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

export function toGroupIds(groupsResponse: DeepReadonly<CistGroupsResponse>) {
  return toGroupsMap(groupsResponse).keys();
}

export function toGroupsMap(groupsResponse: DeepReadonly<CistGroupsResponse>) {
  return iterate(groupsResponse.university.faculties)
    .map(f => f.directions)
    .flatten()
    .map(d => {
      const iterator = iterate(d.specialities)
        .map(s => s.groups)
        .flatten();
      return d.groups ? iterator.concat(d.groups) : iterator;
    })
    .flatten()
    .map(g => t(g.id, g))
    .toMap();
}
