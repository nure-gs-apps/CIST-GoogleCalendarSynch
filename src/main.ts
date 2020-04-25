// IMPORTANT! INSTALLS MONKEY PATCHES
import './polyfills';
import { interfaces } from 'inversify';
import { Arguments } from 'yargs';
import { DeepPartial, DeepReadonly } from './@types';
import { CacheType, IFullAppConfig } from './config/types';
import { createContainer, getContainerAsyncInitializer } from './di/container';
import { TYPES } from './di/types';
// initialize exit handlers
import './services/exit-handler.service';
import { CachedCistJsonClientService } from './services/cist/cached-cist-json-client.service';
import { CistJsonHttpClient } from './services/cist/cist-json-http-client.service';
import {
  assertGroupsResponse,
  assertRoomsResponse,
} from './utils/assert-responses';
import { toPrintString } from './utils/common';

export namespace AssertCommand {
  export interface IOptions extends Arguments<DeepPartial<IFullAppConfig>> {
    types: AssertType[];
  }

  export const typesArgName = nameof<IOptions>(o => o.types);

  export enum AssertType {
    Groups = 'groups', Rooms = 'auditories'
  }

  export function getValidAssertTypes() {
    return Object.values(AssertType) as AssertType[];
  }

  function assertAssertTypes<T extends ReadonlyArray<unknown>>(
    types: T
  ): asserts types is T {
    const validTypes = getValidAssertTypes();
    if (types.filter((t: any) => !validTypes.includes(t)).length !== 0) {
      throw new TypeError(`Types ${toPrintString(types)} must be within choices ${toPrintString(validTypes)}`);
    }
  }

  export async function handle(
    args: IOptions,
    config: DeepReadonly<IFullAppConfig>
  ) {
    assertAssertTypes(args.types);
    const assertTypes = args.types;
    const cacheConfig = config.ncgc.caching.cist;

    const types: interfaces.Newable<any>[] = [CachedCistJsonClientService];
    const checkRooms = assertTypes.includes(AssertType.Rooms);
    const checkGroups = assertTypes.includes(AssertType.Groups);
    if ((
        checkGroups
        && cacheConfig.priorities.groups.includes(CacheType.Http)
      )
      || (
        checkRooms
        && cacheConfig.priorities.auditories.includes(CacheType.Http)
      )) {
      types.push(CistJsonHttpClient);
    }
    const container = createContainer({
      types,
      forceNew: true
    });
    container.bind<CachedCistJsonClientService>(TYPES.CistJsonClient)
      .to(CachedCistJsonClientService);
    await getContainerAsyncInitializer();

    const cistClient = container
      .get<CachedCistJsonClientService>(TYPES.CistJsonClient);
    let failure = false;
    if (checkRooms) {
      failure = failure
        || !assertRoomsResponse(await cistClient.getRoomsResponse());
    }
    if (checkGroups) {
      failure = failure
        || !assertGroupsResponse(await cistClient.getGroupsResponse());
    }
    await cistClient.dispose();
    process.exit(failure ? 1 : 0);
  }
}

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

