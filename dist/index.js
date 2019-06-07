"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// IMPORTANT! INSTALLS MONKEY PATCHES
require("./@types");
const types_1 = require("./di/types");
// initialize exit handlers
require("./services/exit-handler.service");
const container_1 = require("./di/container");
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
    // const groupsResponse = await cistClient.getGroupResponse();
    // assertGroupResponse(groupsResponse);
    // await container.get<RoomsService>(TYPES.RoomsService)
    //   .deleteAll();
    // logger.info('Rooms are deleted');
    // await container.get<BuildingsService>(TYPES.BuildingsService)
    //   .deleteAll();
    // logger.info('Buildings are deleted');
    await container.get(types_1.TYPES.BuildingsService)
        .ensureBuildings(roomsResponse);
    logger_service_1.logger.info('Buildings are loaded');
    await container.get(types_1.TYPES.RoomsService)
        .ensureRooms(roomsResponse);
    logger_service_1.logger.info('Rooms are loaded');
}
//# sourceMappingURL=index.js.map