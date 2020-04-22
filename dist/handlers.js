"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// IMPORTANT! INSTALLS MONKEY PATCHES
require("./polyfills");
const types_1 = require("./di/types");
// initialize exit handlers
require("./services/exit-handler.service");
const cached_cist_json_client_service_1 = require("./services/cist/cached-cist-json-client.service");
async function assertResponse(args, container) {
    container.bind(types_1.TYPES.CistJsonClient)
        .to(cached_cist_json_client_service_1.CachedCistJsonClientService);
    // const cistClient = container
    //   .get<CistJsonHttpClient>(TYPES.CistJsonHttpClient);
    console.log(args, args.types);
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
    // //   TimetableType.GROUP,
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
}
exports.assertResponse = assertResponse;
//# sourceMappingURL=handlers.js.map