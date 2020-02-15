"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// IMPORTANT! INSTALLS MONKEY PATCHES
require("./polyfills");
const container_1 = require("./di/container");
const types_1 = require("./di/types");
// initialize exit handlers
require("./services/exit-handler.service");
const logger_service_1 = require("./services/logger.service");
const container = container_1.createContainer();
container_1.getAsyncInitializers().then(main);
async function main() {
    const cistClient = container
        .get(types_1.TYPES.CistJsonClient);
    const roomsResponse = await cistClient.getRoomsResponse();
    // if (!assertRoomsResponse(roomsResponse)) {
    //   return;
    // }
    const groupsResponse = await cistClient.getGroupsResponse();
    // if (!assertGroupsResponse(groupsResponse)) {
    //   return;
    // }
    // const eventsResponse = await cistClient.getEventsResponse(
    //   TimetableType.GROUP,
    //   4901435,
    // );
    // if (!assertEventsResponse(eventsResponse)) {
    //   return;
    // }
    const buildingsService = container.get(types_1.TYPES.BuildingsService);
    const roomsService = container.get(types_1.TYPES.RoomsService);
    const groupsService = container.get(types_1.TYPES.GroupsService);
    // await roomsService.deleteAll();
    // logger.info('Rooms are deleted');
    // await buildingsService.deleteAll();
    // logger.info('Buildings are deleted');
    // await groupsService.deleteAll();
    // logger.info('Groups are deleted');
    await buildingsService.ensureBuildings(roomsResponse);
    logger_service_1.logger.info('Buildings are loaded');
    const roomNameChanges = await roomsService.ensureRooms(roomsResponse, true);
    logger_service_1.logger.info('Rooms are loaded');
    const groupNameChanges = await groupsService.ensureGroups(groupsResponse, true);
    logger_service_1.logger.info('Groups are loaded');
    const calendarService = container.get(types_1.TYPES.CalendarService);
    const calendars = await calendarService.getEnsuredCalendars(groupsResponse, roomsResponse, groupNameChanges, roomNameChanges);
    logger_service_1.logger.info(calendars);
    logger_service_1.logger.info('Calendars are created');
}
//# sourceMappingURL=main.js.map