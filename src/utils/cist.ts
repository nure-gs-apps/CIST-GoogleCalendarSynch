import { iterate } from 'iterare';
import { ApiBuilding } from '../services/cist/types';
import { transformFloorname } from '../services/google/google-utils.service';

export function getFloornamesFromBuilding(building: ApiBuilding) {
  return Array.from(iterate(building.auditories)
    .map(r => transformFloorname(r.floor))
    .toSet()
    .values());
}
