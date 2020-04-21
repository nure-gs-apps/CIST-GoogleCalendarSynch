import {
  ApiAuditoriesResponse, ApiEventsResponse, ApiGroup,
  ApiGroupsResponse,
} from '../services/cist/types';
import { logger } from '../services/logger.service';

export function assertRoomsResponse(body: any): body is ApiAuditoriesResponse {
  const response = body as ApiAuditoriesResponse;
  const responseOk = typeof response === 'object'
    && Object.keys(response).length === 1
    && typeof response.university === 'object';
  logger.info('response OK', responseOk);
  if (!responseOk) {
    logger.info('response keys:', Object.keys(response));
    return false;
  }

  const university = response.university;
  const universityOk = typeof university === 'object'
    && Object.keys(university).length === 3
    && typeof university.short_name === 'string'
    && typeof university.full_name === 'string'
    && Array.isArray(university.buildings);
  logger.info('university OK', universityOk);
  if (!universityOk) {
    logger.info('university keys:', Object.keys(university));
    return false;
  }

  for (const building of university.buildings) {
    const buildingOk = typeof building === 'object'
      && Object.keys(building).length === 4
      && typeof building.id === 'string'
      && typeof building.short_name === 'string'
      && typeof building.full_name === 'string'
      && Array.isArray(building.auditories);
    logger.info(`building ${building.full_name} ok: ${buildingOk}`);
    if (!buildingOk) {
      logger.info('building keys:', Object.keys(building));
      return false;
    }
    logger.info(building.id === building.short_name
      ? 'short name is id'
      : 'short name is not id');

    for (const room of building.auditories) {
      const roomOk = typeof room === 'object'
        && Object.keys(room).length === 5
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
        const typeOk = typeof type === 'object'
          && Object.keys(type).length === 2
          && typeof type.id === 'string'
          && typeof type.short_name === 'string';
        logger.info(`room type ${type.short_name} ok: ${typeOk}`);
        if (!typeOk) {
          logger.info('type keys:', Object.keys(type));
          return false;
        }
      }
    }
  }
  return true;
}

export function assertGroupsResponse(body: any): body is ApiGroupsResponse {
  const response = body as ApiGroupsResponse;

  const responseOk = typeof response === 'object'
    && Object.keys(response).length === 1
    && typeof response.university === 'object';
  logger.info('response OK', responseOk);
  if (!responseOk) {
    logger.info('response keys:', Object.keys(response));
    return false;
  }

  const university = response.university;
  const universityOk = typeof university === 'object'
    && Object.keys(university).length === 3
    && typeof university.short_name === 'string'
    && typeof university.full_name === 'string'
    && Array.isArray(university.faculties);
  logger.info('university OK', universityOk);
  if (!universityOk) {
    logger.info('university keys:', Object.keys(university));
    return false;
  }

  for (const faculty of university.faculties) {
    const facultyOk = typeof faculty === 'object'
      && Object.keys(faculty).length === 4
      && typeof faculty.id === 'number'
      && typeof faculty.short_name === 'string'
      && typeof faculty.full_name === 'string'
      && Array.isArray(faculty.directions);
    logger.info(`faculty ${faculty.short_name} is ok: ${facultyOk}`);
    if (!facultyOk) {
      logger.info('faculty keys:', Object.keys(faculty));
      return false;
    }
    for (const direction of faculty.directions) {
      const directionKeys = Object.keys(direction);
      const directionOk = typeof direction === 'object'
        && directionKeys.length >= 4
        && typeof direction.id === 'number'
        && typeof direction.short_name === 'string'
        && typeof direction.full_name === 'string'
        && (
          directionKeys.length === 4
          && !direction.groups
        ) || (
          directionKeys.length === 5
          && Array.isArray(direction.groups)
        ) && Array.isArray(direction.specialities);
      logger.info(`direction ${direction.short_name} is ok: ${directionOk}`);
      if (!directionOk) {
        logger.info('direction keys:', directionKeys);
        return false;
      }
      if (direction.groups) {
        for (const group of direction.groups) {
          if (!assertGroup(group)) {
            return false;
          }
        }
      }
      for (const speciality of direction.specialities) {
        const specialityOk = typeof speciality === 'object'
          && Object.keys(speciality).length === 4
          && typeof speciality.id === 'number'
          && typeof speciality.short_name === 'string'
          && typeof speciality.full_name === 'string'
          && Array.isArray(speciality.groups);
        logger.info(`speciality ${speciality.short_name} ok: ${specialityOk}`);
        if (!specialityOk) {
          logger.info('speciality keys:', Object.keys(speciality));
          return false;
        }
        for (const group of speciality.groups) {
          if (!assertGroup(group)) {
            return false;
          }
        }
      }
    }
  }

  return true;
}

export function assertEventsResponse(body: any): body is ApiEventsResponse {
  const response = body as ApiEventsResponse;

  const responseOk = typeof response === 'object'
    && Object.keys(response).length === 6
    && typeof response['time-zone'] === 'string'
    && Array.isArray(response.events)
    && Array.isArray(response.groups)
    && Array.isArray(response.teachers)
    && Array.isArray(response.subjects)
    && Array.isArray(response.types);
  logger.info('response ok:', responseOk);
  if (!responseOk) {
    logger.info('response keys:', Object.keys(response));
    return false;
  }

  for (const event of response.events) {
    const eventOk = typeof event === 'object'
      && Object.keys(event).length === 8
      && typeof event.subject_id === 'number'
      && typeof event.start_time === 'number'
      && typeof event.end_time === 'number'
      && typeof event.type === 'number'
      && typeof event.number_pair === 'number'
      && typeof event.auditory === 'string'
      && assertTeachers(event.teachers)
      && Array.isArray(event.groups);
    logger.info(`event ${JSON.stringify(event)} is ok: ${eventOk}`);
    if (!eventOk) {
      return false;
    }

    for (const group of event.groups) {
      const groupOk = typeof group === 'number';
      logger.info(`event group ${group} is ok: ${groupOk}`);
      if (!groupOk) {
        return false;
      }
    }
  }

  for (const group of response.groups) {
    if (!assertGroup(group)) {
      return false;
    }
  }

  for (const teacher of response.teachers) {
    const teacherOk = typeof teacher === 'object'
      && Object.keys(teacher).length === 3
      && typeof teacher.id === 'string'
      && typeof teacher.short_name === 'string'
      && typeof teacher.full_name === 'string';
    logger.info(`teacher ${teacher.short_name} is ok: ${teacherOk}`);
    if (!teacherOk) {
      logger.info('teacher keys:', Object.keys(teacher));
      return false;
    }
  }

  for (const subject of response.subjects) {
    const subjectOk = typeof subject === 'object'
      && Object.keys(subject).length === 4
      && typeof subject.id === 'number'
      && typeof subject.brief === 'number'
      && typeof subject.title === 'number'
      && Array.isArray(subject.hours);
    logger.info(`subject ${subject.brief} is ok: ${subjectOk}`);
    if (!subjectOk) {
      logger.info('subject keys:', Object.keys(subject));
      return false;
    }

    for (const hour of subject.hours) {
      const hourOk = typeof hour === 'object'
        && Object.keys(hour).length === 3
        && typeof hour.type === 'number'
        && typeof hour.val === 'number'
        && assertTeachers(hour.teachers);
      logger.info(`hour ${hour.type} is ok: ${hourOk}`);
      if (!hourOk) {
        logger.info('hour keys:', Object.keys(hour));
        return false;
      }
    }
  }

  for (const type of response.types) {
    const typeOk = typeof type === 'object'
      && Object.keys(type).length === 5
      && typeof type.id === 'number'
      && typeof type.short_name === 'string'
      && typeof type.full_name === 'string'
      && typeof type.id_base === 'number'
      && typeof type.type === 'string';
    logger.info(`type ${type.short_name} is ok: ${typeOk}`);
    if (!typeOk) {
      logger.info('type keys:', Object.keys(type));
      return false;
    }
  }

  return true;
}

function assertGroup(obj: any): obj is ApiGroup {
  const group = obj as ApiGroup;
  const groupOk = typeof group === 'object'
    && Object.keys(group).length === 2
    && typeof group.id === 'number'
    && typeof group.name === 'string';
  logger.info(`group ${group.name} ok: ${groupOk}`);
  if (!groupOk) {
    logger.info('group keys:', Object.keys(group));
    return false;
  }
  return true;
}

function assertTeachers(arr: any): arr is number[] {
  const teachers = arr as number[];
  const teachersOk = Array.isArray(teachers)
    && teachers.every(t => typeof t === 'number');
  if (!teachersOk) {
    logger.info('teachers:', teachers);
  }
  return teachersOk;
}
