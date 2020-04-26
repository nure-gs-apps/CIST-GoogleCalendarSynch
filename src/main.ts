// IMPORTANT! INSTALLS MONKEY PATCHES
import './polyfills';
// import { interfaces } from 'inversify';
import { Arguments } from 'yargs';
import { DeepPartial, DeepReadonly, Nullable } from './@types';
import {
  // CacheType,
  IFullAppConfig,
} from './config/types';
// import { createContainer, getContainerAsyncInitializer } from './di/container';
// import { TYPES } from './di/types';
// initialize exit handlers
import './services/exit-handler.service';
// import { CachedCistJsonClientService } from './services/cist/cached-cist-json-client.service';
// import { CistJsonHttpClient } from './services/cist/cist-json-http-client.service';
// import {
//   assertGroupsResponse,
//   assertRoomsResponse,
// } from './utils/assert-responses';
import { toPrintString } from './utils/common';

export enum EntityType {
  Groups = 'groups', Rooms = 'auditories'
}

export interface IArgsWithEntities extends Arguments<DeepPartial<IFullAppConfig>> {
  groups: boolean;
  auditories: boolean;
  events: Nullable<number[]>;
}

export function assertHasEntities(args: DeepReadonly<IArgsWithEntities>) {
  if (!args.groups && !args.auditories && !args.events) {
    throw new TypeError('No entities selected. At least one of groups, auditories or events must be chosen');
  }
  return true;
}

export namespace AssertCommand {
  export interface IOptions extends Arguments<DeepPartial<IFullAppConfig>> {
    entities: EntityType[];
  }

  export const entitiesArgName = nameof<IOptions>(o => o.entities);

  export function getValidAssertTypes() {
    return Object.values(EntityType) as EntityType[];
  }

  export function assertAssertTypes<T extends ReadonlyArray<unknown>>(
    types: T
  ): asserts types is T {
    const validTypes = getValidAssertTypes();
    if (types.filter((t: any) => !validTypes.includes(t)).length !== 0) {
      throw new TypeError(`Types ${toPrintString(types)} must be within choices ${toPrintString(validTypes)}`);
    }
  }

  export async function handle(
    args: IArgsWithEntities,
    config: DeepReadonly<IFullAppConfig>
  ) {
    console.log(args);
    // assertAssertTypes(args.entities);
    // const assertTypes = args.entities;
    // const cacheConfig = config.ncgc.caching.cist;
    //
    // const types: interfaces.Newable<any>[] = [CachedCistJsonClientService];
    // const checkRooms = assertTypes.includes(EntityType.Rooms);
    // const checkGroups = assertTypes.includes(EntityType.Groups);
    // if ((
    //     checkGroups
    //     && cacheConfig.priorities.groups.includes(CacheType.Http)
    //   )
    //   || (
    //     checkRooms
    //     && cacheConfig.priorities.auditories.includes(CacheType.Http)
    //   )) {
    //   types.push(CistJsonHttpClient);
    // }
    // const container = createContainer({
    //   types,
    //   forceNew: true
    // });
    // container.bind<CachedCistJsonClientService>(TYPES.CistJsonClient)
    //   .to(CachedCistJsonClientService);
    // await getContainerAsyncInitializer();
    //
    // const cistClient = container
    //   .get<CachedCistJsonClientService>(TYPES.CistJsonClient);
    // let failure = false;
    // if (checkRooms) {
    //   failure = failure
    //     || !assertRoomsResponse(await cistClient.getRoomsResponse());
    // }
    // if (checkGroups) {
    //   failure = failure
    //     || !assertGroupsResponse(await cistClient.getGroupsResponse());
    // }
    // await cistClient.dispose();
    // process.exit(failure ? 1 : 0);
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

