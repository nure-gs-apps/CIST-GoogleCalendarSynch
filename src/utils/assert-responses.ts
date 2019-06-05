import { ApiAuditoriesResponse } from '../services/cist-json-client.service';
import { logger } from '../services/logger.service';

export function assertRoomResponse(body: any): body is ApiAuditoriesResponse {
  const response = body as ApiAuditoriesResponse;
  const responseOk = Object.keys(response).length === 1
    && typeof response.university === 'object';
  logger.info('response OK', responseOk);
  if (!responseOk) {
    logger.info('response keys:', Object.keys(response));
    return false;
  }

  const university = response.university;
  const universityOk = Object.keys(university).length === 3
    && typeof university.short_name === 'string'
    && typeof university.full_name === 'string'
    && Array.isArray(university.buildings);
  logger.info('university OK', universityOk);
  if (!universityOk) {
    logger.info('university keys:', Object.keys(university));
    return false;
  }

  for (const building of university.buildings) {
    const buildingOk = Object.keys(building).length === 4
      && typeof building.id === 'string'
      && typeof building.short_name === 'string'
      && typeof building.full_name === 'string'
      && Array.isArray(building.auditories);
    logger.info(`building ${building.full_name} ok: ${buildingOk}`);
    logger.info(building.id === building.short_name
      ? 'short name is id'
      : 'short name is not id');

    for (const room of building.auditories) {
      const roomOk = Object.keys(room).length === 5
        && typeof room.id === 'string'
        && typeof room.short_name === 'string'
        && typeof room.floor === 'string'
        && typeof room.is_have_power === 'string'
        && Array.isArray(room.auditory_types);
      logger.info(`room ${room.short_name} is ok: ${roomOk}`);
      if (!roomOk) {
        logger.info('room keys:', Object.keys(room));
        return false;
      }
      logger.info(`is_have_power: ${room.is_have_power}`);
      logger.info(!Number.isNaN(Number.parseInt(room.floor, 10)) ? 'floor: number' : 'floor: not number');

      for (const type of room.auditory_types) {
        const typeOk = Object.keys(type).length === 2
          && typeof type.id === 'string'
          && typeof type.short_name === 'string';
        logger.info(`room type ${type.short_name} ok: ${roomOk}`);
      }
    }
  }
  return true;
}
