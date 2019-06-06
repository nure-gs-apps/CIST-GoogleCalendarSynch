// IMPORTANT! INSTALLS MONKEY PATCHES
import './@types';
import { TYPES } from './di/types';
// initialize exit handlers
import './services/exit-handler.service';
import { createContainer, getAsyncInitializers } from './di/container';
import { CistJsonClient } from './services/cist-json-client.service';
import { BuildingsService } from './services/google/buildings.service';
import { GoogleAuth } from './services/google/google-auth';
import { RoomsService } from './services/google/rooms.service';
import { logger } from './services/logger.service';
import {
  assertGroupResponse,
  assertRoomsResponse,
} from './utils/assert-responses';

const container = createContainer();
getAsyncInitializers().then(main);

async function main() {
  const cistClient = container
    .get<CistJsonClient>(TYPES.CistJsonClient);
  const roomsResponse = await cistClient.getRoomsResponse();

  // if (!assertRoomsResponse(roomsResponse)) {
  //   return;
  // }
  // const groupsResponse = await cistClient.getGroupResponse();
  // assertGroupResponse(groupsResponse);
  await container.get<BuildingsService>(TYPES.BuildingsService)
    .ensureBuildings(roomsResponse);
  logger.info('Buildings are loaded');
  await container.get<RoomsService>(TYPES.RoomsService)
    .ensureRooms(roomsResponse);
  logger.info('Rooms are loaded');
}
