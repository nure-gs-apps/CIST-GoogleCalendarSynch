import iterate from 'iterare';
import { DeepReadonly, t } from '../@types';
import { CistBuilding, CistGroupsResponse } from '../@types/cist';
import { ICistGroupData } from '../@types/google';
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

export function toGroupDataMap(
  groupsResponse: DeepReadonly<CistGroupsResponse>
) {
  return iterate(groupsResponse.university.faculties)
    .map(f => iterate(f.directions).map(d => ({
      faculty: f,
      direction: d
    })))
    .flatten()
    .map(data => {
      const iterator = iterate(data.direction.specialities)
        .map(s => iterate(s.groups).map(g => ({
          faculty: data.faculty,
          direction: data.direction,
          speciality: s,
          group: g
        })))
        .flatten();
      return data.direction.groups
        ? iterate(data.direction.groups).map(g => ({
          faculty: data.faculty,
          direction: data.direction,
          group: g
        })).concat(iterator)
        : iterator;
    })
    .flatten()
    .map(d => t(d.group.id, d as ICistGroupData))
    .toMap();
}
