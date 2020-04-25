import {
  ApiAuditoriesResponse, ApiEventsResponse, ApiGroup,
  ApiGroupsResponse,
} from '../services/cist/types';

export type LogFunction = (message: string, ...args: any[]) => void;

export function assertRoomsResponse(
  body: any,
  log: LogFunction = console.log,
): body is ApiAuditoriesResponse {
  const response = body as ApiAuditoriesResponse;
  const responseOk = typeof response === 'object'
    && Object.keys(response).length === 1
    && typeof response.university === 'object';
  log('response OK', responseOk);
  if (!responseOk) {
    log('response keys:', Object.keys(response));
    return false;
  }

  const university = response.university;
  const universityOk = typeof university === 'object'
    && Object.keys(university).length === 3
    && typeof university.short_name === 'string'
    && typeof university.full_name === 'string'
    && Array.isArray(university.buildings);
  log('university OK', universityOk);
  if (!universityOk) {
    log('university keys:', Object.keys(university));
    return false;
  }

  for (const building of university.buildings) {
    const buildingOk = typeof building === 'object'
      && Object.keys(building).length === 4
      && typeof building.id === 'string'
      && typeof building.short_name === 'string'
      && typeof building.full_name === 'string'
      && Array.isArray(building.auditories);
    log(`building ${building.full_name} ok: ${buildingOk}`);
    if (!buildingOk) {
      log('building keys:', Object.keys(building));
      return false;
    }
    log(building.id === building.short_name
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
      log(`room ${room.short_name} is ok: ${roomOk}`);
      if (!roomOk) {
        log('room keys:', Object.keys(room));
        return false;
      }
      log(`is_have_power: ${room.is_have_power}`);
      log(!Number.isNaN(Number.parseInt(room.floor, 10)) ? 'floor: number' : 'floor: not number');

      for (const type of room.auditory_types) {
        const typeOk = typeof type === 'object'
          && Object.keys(type).length === 2
          && typeof type.id === 'string'
          && typeof type.short_name === 'string';
        log(`room type ${type.short_name} ok: ${typeOk}`);
        if (!typeOk) {
          log('type keys:', Object.keys(type));
          return false;
        }
      }
    }
  }
  return true;
}

export function assertGroupsResponse(
  body: any,
  log: LogFunction = console.log,
): body is ApiGroupsResponse {
  const response = body as ApiGroupsResponse;

  const responseOk = typeof response === 'object'
    && Object.keys(response).length === 1
    && typeof response.university === 'object';
  log('response OK', responseOk);
  if (!responseOk) {
    log('response keys:', Object.keys(response));
    return false;
  }

  const university = response.university;
  const universityOk = typeof university === 'object'
    && Object.keys(university).length === 3
    && typeof university.short_name === 'string'
    && typeof university.full_name === 'string'
    && Array.isArray(university.faculties);
  log('university OK', universityOk);
  if (!universityOk) {
    log('university keys:', Object.keys(university));
    return false;
  }

  for (const faculty of university.faculties) {
    const facultyOk = typeof faculty === 'object'
      && Object.keys(faculty).length === 4
      && typeof faculty.id === 'number'
      && typeof faculty.short_name === 'string'
      && typeof faculty.full_name === 'string'
      && Array.isArray(faculty.directions);
    log(`faculty ${faculty.short_name} is ok: ${facultyOk}`);
    if (!facultyOk) {
      log('faculty keys:', Object.keys(faculty));
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
      log(`direction ${direction.short_name} is ok: ${directionOk}`);
      if (!directionOk) {
        log('direction keys:', directionKeys);
        return false;
      }
      if (direction.groups) {
        for (const group of direction.groups) {
          if (!assertGroup(group, log)) {
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
        log(`speciality ${speciality.short_name} ok: ${specialityOk}`);
        if (!specialityOk) {
          log('speciality keys:', Object.keys(speciality));
          return false;
        }
        for (const group of speciality.groups) {
          if (!assertGroup(group, log)) {
            return false;
          }
        }
      }
    }
  }

  return true;
}

export function assertEventsResponse(
  body: any,
  log: LogFunction = console.log,
): body is ApiEventsResponse {
  const response = body as ApiEventsResponse;

  const responseOk = typeof response === 'object'
    && Object.keys(response).length === 6
    && typeof response['time-zone'] === 'string'
    && Array.isArray(response.events)
    && Array.isArray(response.groups)
    && Array.isArray(response.teachers)
    && Array.isArray(response.subjects)
    && Array.isArray(response.types);
  log('response ok:', responseOk);
  if (!responseOk) {
    log('response keys:', Object.keys(response));
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
      && assertTeachers(event.teachers, log)
      && Array.isArray(event.groups);
    log(`event ${JSON.stringify(event)} is ok: ${eventOk}`);
    if (!eventOk) {
      return false;
    }

    for (const group of event.groups) {
      const groupOk = typeof group === 'number';
      log(`event group ${group} is ok: ${groupOk}`);
      if (!groupOk) {
        return false;
      }
    }
  }

  for (const group of response.groups) {
    if (!assertGroup(group, log)) {
      return false;
    }
  }

  for (const teacher of response.teachers) {
    const teacherOk = typeof teacher === 'object'
      && Object.keys(teacher).length === 3
      && typeof teacher.id === 'string'
      && typeof teacher.short_name === 'string'
      && typeof teacher.full_name === 'string';
    log(`teacher ${teacher.short_name} is ok: ${teacherOk}`);
    if (!teacherOk) {
      log('teacher keys:', Object.keys(teacher));
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
    log(`subject ${subject.brief} is ok: ${subjectOk}`);
    if (!subjectOk) {
      log('subject keys:', Object.keys(subject));
      return false;
    }

    for (const hour of subject.hours) {
      const hourOk = typeof hour === 'object'
        && Object.keys(hour).length === 3
        && typeof hour.type === 'number'
        && typeof hour.val === 'number'
        && assertTeachers(hour.teachers, log);
      log(`hour ${hour.type} is ok: ${hourOk}`);
      if (!hourOk) {
        log('hour keys:', Object.keys(hour));
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
    log(`type ${type.short_name} is ok: ${typeOk}`);
    if (!typeOk) {
      log('type keys:', Object.keys(type));
      return false;
    }
  }

  return true;
}

function assertGroup(
  obj: any,
  log: LogFunction = console.log,
): obj is ApiGroup {
  const group = obj as ApiGroup;
  const groupOk = typeof group === 'object'
    && Object.keys(group).length === 2
    && typeof group.id === 'number'
    && typeof group.name === 'string';
  log(`group ${group.name} ok: ${groupOk}`);
  if (!groupOk) {
    log('group keys:', Object.keys(group));
    return false;
  }
  return true;
}

function assertTeachers(
  arr: any,
  log: LogFunction = console.log,
): arr is number[] {
  const teachers = arr as number[];
  const teachersOk = Array.isArray(teachers)
    && teachers.every(t => typeof t === 'number');
  if (!teachersOk) {
    log('teachers:', teachers);
  }
  return teachersOk;
}
