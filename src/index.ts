// IMPORTANT! INSTALLS MONKEY PATCHES
import './@types';
import { createContainer, getAsyncInitializers } from './di/container';
import { TYPES } from './di/types';
import {
  CistJsonClient,
  TimetableType,
} from './services/cist-json-client.service';
// initialize exit handlers
import './services/exit-handler.service';
import { BuildingsService } from './services/google/buildings.service';
import { CalendarService } from './services/google/calendar.service';
import { GroupsService } from './services/google/groups.service';
import { RoomsService } from './services/google/rooms.service';
import { logger } from './services/logger.service';
import {
  assertEventsResponse,
  assertGroupsResponse,
} from './utils/assert-responses';

const container = createContainer();
getAsyncInitializers().then(main);

async function main() {
  // const cistClient = container
  //   .get<CistJsonClient>(TYPES.CistJsonClient);

  // const roomsResponse = await cistClient.getRoomsResponse();
  // if (!assertRoomsResponse(roomsResponse)) {
  //   return;
  // }

  // const groupsResponse = await cistClient.getGroupsResponse();
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

  // const buildingsService = container.get<BuildingsService>(
  //   TYPES.BuildingsService,
  // );
  // const roomsService = container.get<RoomsService>(TYPES.RoomsService);
  // const groupsService = container.get<GroupsService>(TYPES.GroupsService);

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

  const calendarService = container.get<CalendarService>(TYPES.CalendarService);
  const calendar = await calendarService.ensureCalendar();
  logger.info(calendar);
}
