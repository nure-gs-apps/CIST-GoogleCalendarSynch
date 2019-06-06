"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// IMPORTANT! INSTALLS MONKEY PATCHES
require("./@types");
const types_1 = require("./di/types");
// initialize exit handlers
require("./services/exit-handler.service");
const container_1 = require("./di/container");
const assert_responses_1 = require("./utils/assert-responses");
const container = container_1.createContainer();
container_1.getAsyncInitializers().then(main);
async function main() {
    const cistClient = container
        .get(types_1.TYPES.CistJsonClient);
    // const roomsResponse = await cistClient.getRoomsResponse();
    // if (!assertRoomsResponse(roomsResponse)) {
    //   return;
    // }
    const groupsResponse = await cistClient.getGroupResponse();
    assert_responses_1.assertGroupResponse(groupsResponse);
    // await container.get<BuildingsService>(TYPES.BuildingsService)
    //   .ensureBuildings(roomsResponse);
    // logger.info('Buildings are loaded');
    // await container.get<RoomsService>(TYPES.RoomsService)
    //   .ensureRooms(roomsResponse);
    // logger.info('Rooms are loaded');
}
//# sourceMappingURL=index.js.map