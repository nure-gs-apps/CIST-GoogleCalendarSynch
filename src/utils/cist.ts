import { iterate } from 'iterare';
import { ApiBuilding } from '../services/cist-json-client.service';
import { transformFloorname } from '../services/google/utils.service';

export function getFloornamesFromBuilding(building: ApiBuilding) {
  return Array.from(iterate(building.auditories)
    .map(r => transformFloorname(r.floor))
    .toSet()
    .values());
}
