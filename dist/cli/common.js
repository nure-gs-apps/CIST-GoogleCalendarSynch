"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const iterare_1 = require("iterare");
const common_1 = require("../utils/common");
function assertHasEntities(args) {
    if (!args.groups && !args.auditories && !args.events) {
        throw new TypeError('No entities selected. At least one of groups, auditories or events must be chosen');
    }
    return true;
}
exports.assertHasEntities = assertHasEntities;
function addEntitiesOptions(yargs, logger = console) {
    const groupsName = "groups";
    const auditoriesName = "auditories";
    const eventsName = "events";
    return yargs
        .option(groupsName, {
        alias: groupsName[0],
        description: 'Operate on groups',
        type: 'boolean'
    })
        .option(auditoriesName, {
        alias: auditoriesName[0],
        description: 'Operate on auditories',
        type: 'boolean'
    })
        .option(eventsName, {
        alias: eventsName[0],
        description: 'Operate on events. Supply "all", "" or nothing for all events. Supply list of coma-separated (no spaces) Group IDs to fetch events for',
        type: 'string',
        coerce(value) {
            const str = value;
            if (str === '' || str === 'all') {
                return [];
            }
            if (!value) {
                return null;
            }
            const initialArgs = str.split(/\s*,\s*/);
            const ids = iterare_1.default(initialArgs)
                .map(v => Number.parseInt(v, 10))
                .filter(v => !Number.isNaN(v))
                .toArray();
            if (ids.length === 0) {
                throw new TypeError('No Group IDs parsed');
            }
            if (initialArgs.length !== ids.length) {
                logger.warn(`Only such IDs found: ${common_1.toPrintString(ids)}`);
            }
            return ids;
        },
        requiresArg: false,
    })
        .check(args => assertHasEntities(args));
}
exports.addEntitiesOptions = addEntitiesOptions;
// const roomsResponse = await cistClient.getRoomsResponse();
// // if (!assertRoomsResponse(roomsResponse)) {
// //   return;
// // }
//
// const groupsResponse = await cistClient.getGroupsResponse();
// // if (!assertGroupsResponse(groupsResponse)) {
// //   return;
// // }
//
// // const eventsResponse = await cistClient.getEventsResponse(
// //   TimetableType.Group,
// //   4901435,
// // );
// // if (!assertEventsResponse(eventsResponse)) {
// //   return;
// // }
//
// const buildingsService = container.get<BuildingsService>(
//   TYPES.BuildingsService,
// );
// const roomsService = container.get<RoomsService>(TYPES.RoomsService);
// const groupsService = container.get<GroupsService>(TYPES.GroupsService);
//
// // await roomsService.deleteAll();
// // logger.info('Rooms are deleted');
// // await buildingsService.deleteAll();
// // logger.info('Buildings are deleted');
// // await groupsService.deleteAll();
// // logger.info('Groups are deleted');
//
// await buildingsService.ensureBuildings(roomsResponse);
// logger.info('Buildings are loaded');
// const roomNameChanges = await roomsService.ensureRooms(roomsResponse, true);
// logger.info('Rooms are loaded');
// const groupNameChanges = await groupsService.ensureGroups(
//   groupsResponse,
//   true,
// );
// logger.info('Groups are loaded');
//
// const calendarService = container.get<CalendarService>(TYPES.CalendarService);
// const calendars = await calendarService.getEnsuredCalendars(
//   groupsResponse,
//   roomsResponse,
//   groupNameChanges,
//   roomNameChanges,
// );
// logger.info(calendars);
// logger.info('Calendars are created');
//# sourceMappingURL=common.js.map