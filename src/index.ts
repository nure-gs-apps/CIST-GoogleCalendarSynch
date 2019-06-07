// IMPORTANT! INSTALLS MONKEY PATCHES
import './@types';
import { TYPES } from './di/types';
// initialize exit handlers
import './services/exit-handler.service';
import { createContainer, getAsyncInitializers } from './di/container';
import { CistJsonClient } from './services/cist-json-client.service';
import { BuildingsService } from './services/google/buildings.service';
import { GoogleDirectoryAuth } from './services/google/google-directory-auth';
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

  // await container.get<RoomsService>(TYPES.RoomsService)
  //   .deleteAll();
  // logger.info('Rooms are deleted');
  // await container.get<BuildingsService>(TYPES.BuildingsService)
  //   .deleteAll();
  // logger.info('Buildings are deleted');

  await container.get<BuildingsService>(TYPES.BuildingsService)
    .ensureBuildings(roomsResponse);
  logger.info('Buildings are loaded');
  await container.get<RoomsService>(TYPES.RoomsService)
    .ensureRooms(roomsResponse);
  logger.info('Rooms are loaded');
}
