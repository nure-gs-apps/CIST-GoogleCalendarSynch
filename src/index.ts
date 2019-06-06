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
import { assertRoomResponse } from './utils/assert-responses';

const container = createContainer();
getAsyncInitializers().then(main);

async function main() {
  const response = await container.get<CistJsonClient>(TYPES.CistJsonClient)
    .getRoomResponse();
  await container.get<BuildingsService>(TYPES.BuildingsService)
    .ensureBuildings(response);
  logger.info('Buildings are loaded');
  await container.get<RoomsService>(TYPES.RoomsService)
    .ensureRooms(response);
  logger.info('Rooms are loaded');
}
