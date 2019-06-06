"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const logger_service_1 = require("../services/logger.service");
function assertRoomsResponse(body) {
    const response = body;
    const responseOk = Object.keys(response).length === 1
        && typeof response.university === 'object';
    logger_service_1.logger.info('response OK', responseOk);
    if (!responseOk) {
        logger_service_1.logger.info('response keys:', Object.keys(response));
        return false;
    }
    const university = response.university;
    const universityOk = Object.keys(university).length === 3
        && typeof university.short_name === 'string'
        && typeof university.full_name === 'string'
        && Array.isArray(university.buildings);
    logger_service_1.logger.info('university OK', universityOk);
    if (!universityOk) {
        logger_service_1.logger.info('university keys:', Object.keys(university));
        return false;
    }
    for (const building of university.buildings) {
        const buildingOk = typeof building === 'object'
            && Object.keys(building).length === 4
            && typeof building.id === 'string'
            && typeof building.short_name === 'string'
            && typeof building.full_name === 'string'
            && Array.isArray(building.auditories);
        logger_service_1.logger.info(`building ${building.full_name} ok: ${buildingOk}`);
        if (!buildingOk) {
            logger_service_1.logger.info('building keys:', Object.keys(building));
            return false;
        }
        logger_service_1.logger.info(building.id === building.short_name
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
            logger_service_1.logger.info(`room ${room.short_name} is ok: ${roomOk}`);
            if (!roomOk) {
                logger_service_1.logger.info('room keys:', Object.keys(room));
                return false;
            }
            logger_service_1.logger.info(`is_have_power: ${room.is_have_power}`);
            logger_service_1.logger.info(!Number.isNaN(Number.parseInt(room.floor, 10)) ? 'floor: number' : 'floor: not number');
            for (const type of room.auditory_types) {
                const typeOk = typeof type === 'object'
                    && Object.keys(type).length === 2
                    && typeof type.id === 'string'
                    && typeof type.short_name === 'string';
                logger_service_1.logger.info(`room type ${type.short_name} ok: ${typeOk}`);
                if (!typeOk) {
                    logger_service_1.logger.info('type keys:', Object.keys(type));
                    return false;
                }
            }
        }
    }
    return true;
}
exports.assertRoomsResponse = assertRoomsResponse;
function assertGroupResponse(body) {
    const response = body;
    const responseOk = Object.keys(response).length === 1
        && typeof response.university === 'object';
    logger_service_1.logger.info('response OK', responseOk);
    if (!responseOk) {
        logger_service_1.logger.info('response keys:', Object.keys(response));
        return false;
    }
    const university = response.university;
    const universityOk = Object.keys(university).length === 3
        && typeof university.short_name === 'string'
        && typeof university.full_name === 'string'
        && Array.isArray(university.faculties);
    logger_service_1.logger.info('university OK', universityOk);
    if (!universityOk) {
        logger_service_1.logger.info('university keys:', Object.keys(university));
        return false;
    }
    for (const faculty of university.faculties) {
        const facultyOk = typeof faculty === 'object'
            && Object.keys(faculty).length === 4
            && typeof faculty.id === 'number'
            && typeof faculty.short_name === 'string'
            && typeof faculty.full_name === 'string'
            && Array.isArray(faculty.directions);
        logger_service_1.logger.info(`faculty ${faculty.short_name} is ok: ${facultyOk}`);
        if (!facultyOk) {
            logger_service_1.logger.info('faculty keys:', Object.keys(faculty));
            return false;
        }
        for (const direction of faculty.directions) {
            const directionKeys = Object.keys(direction);
            const directionOk = typeof direction === 'object'
                && directionKeys.length >= 4
                && typeof direction.id === 'number'
                && typeof direction.short_name === 'string'
                && typeof direction.full_name === 'string'
                && (directionKeys.length === 4
                    && !direction.groups) || (directionKeys.length === 5
                && Array.isArray(direction.groups)) && Array.isArray(direction.specialities);
            logger_service_1.logger.info(`direction ${direction.short_name} is ok: ${directionOk}`);
            if (!directionOk) {
                logger_service_1.logger.info('direction keys:', directionKeys);
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
                logger_service_1.logger.info(`speciality ${speciality.short_name} ok: ${specialityOk}`);
                if (!specialityOk) {
                    logger_service_1.logger.info('speciality keys:', Object.keys(speciality));
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
exports.assertGroupResponse = assertGroupResponse;
function assertGroup(obj) {
    const group = obj;
    const groupOk = typeof group === 'object'
        && Object.keys(group).length === 2
        && typeof group.id === 'number'
        && typeof group.name === 'string';
    logger_service_1.logger.info(`group ${group.name} ok: ${groupOk}`);
    if (!groupOk) {
        logger_service_1.logger.info('group keys:', Object.keys(group));
        return false;
    }
    return true;
}
//# sourceMappingURL=assert-responses.js.map