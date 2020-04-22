// IMPORTANT! INSTALLS MONKEY PATCHES
import './polyfills';
import { Container } from 'inversify';
import { DeepPartial } from './@types';
import { IFullAppConfig } from './config/types';
import { TYPES } from './di/types';
// initialize exit handlers
import './services/exit-handler.service';
import { CachedCistJsonClientService } from './services/cist/cached-cist-json-client.service';

export interface IAssertOptions extends IFullAppConfig {
  types: string[];
}

export async function assertResponse(
  args: DeepPartial<IAssertOptions>,
  container: Container,
) {
  container.bind<CachedCistJsonClientService>(TYPES.CistJsonClient)
    .to(CachedCistJsonClientService);

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
