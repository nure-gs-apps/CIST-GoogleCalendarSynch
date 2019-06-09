"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// IMPORTANT! INSTALLS MONKEY PATCHES
require("./@types");
const container_1 = require("./di/container");
const types_1 = require("./di/types");
// initialize exit handlers
require("./services/exit-handler.service");
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
    // await buildingsService.ensureBuildings(roomsResponse);
    // logger.info('Buildings are loaded');
    // await roomsService.ensureRooms(roomsResponse);
    // logger.info('Rooms are loaded');
    // await groupsService.ensureGroups(groupsResponse);
    // logger.info('Groups are loaded');
    await groupsService.deleteIrrelevant(groupsResponse);
}
//# sourceMappingURL=index.js.map