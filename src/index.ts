// IMPORTANT! INSTALLS MONKEY PATCHES
import './@types';
import { TYPES } from './di/types';
// initialize exit handlers
import './services/exit-handler.service';
import { createContainer, getAsyncInitializers } from './di/container';
import { CistJsonClient } from './services/cist-json-client.service';
import { BuildingsService } from './services/google/buildings.service';
import { GoogleDirectoryAuth } from './services/google/google-directory-auth';
import { GroupsService } from './services/google/groups.service';
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
  const groupsResponse = await cistClient.getGroupsResponse();
  // assertGroupResponse(groupsResponse);

  const buildingsService = container.get<BuildingsService>(
    TYPES.BuildingsService,
  );
  const roomsService = container.get<RoomsService>(TYPES.RoomsService);
  const groupsService = container.get<GroupsService>(TYPES.GroupsService);

  // await roomsService.deleteAll();
  // logger.info('Rooms are deleted');
  // await buildingsService.deleteAll();
  // logger.info('Buildings are deleted');
  // await groupsService.deleteAll();
  // logger.info('Groups are deleted');

  await buildingsService.ensureBuildings(roomsResponse);
  logger.info('Buildings are loaded');
  await roomsService.ensureRooms(roomsResponse);
  logger.info('Rooms are loaded');
  await groupsService.ensureGroups(groupsResponse);
  logger.info('Groups are loaded');
}
