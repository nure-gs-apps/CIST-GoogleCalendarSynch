// IMPORTANT! INSTALLS MONKEY PATCHES
import { interfaces } from 'inversify';
import iterate from 'iterare';
import { Arguments } from 'yargs';
import { DeepPartial, DeepReadonly, Nullable } from './@types';
import { CacheType, IFullAppConfig } from './config/types';
import { createContainer, getContainerAsyncInitializer } from './di/container';
import { TYPES } from './di/types';
import './polyfills';
import { CachedCistJsonClientService } from './services/cist/cached-cist-json-client.service';
import { CistJsonHttpClient } from './services/cist/cist-json-http-client.service';
import {
  ApiGroup,
  ApiGroupsResponse,
  EntityType,
  TimetableType,
} from './services/cist/types';
// initialize exit handlers
import './services/exit-handler.service';
import { bindOnExitHandler } from './services/exit-handler.service';
import {
  assertEventsResponse,
  assertGroupsResponse,
  assertRoomsResponse,
} from './utils/assert-responses';
import { toPrintString } from './utils/common';

export interface IArgsWithEntities extends Arguments<DeepPartial<IFullAppConfig>> {
  groups: boolean;
  auditories: boolean;
  events: Nullable<number[]>; // empty means all
}

export function assertHasEntities(args: DeepReadonly<IArgsWithEntities>) {
  if (!args.groups && !args.auditories && !args.events) {
    throw new TypeError('No entities selected. At least one of groups, auditories or events must be chosen');
  }
  return true;
}

export namespace AssertCommand {

  export async function handle(
    args: IArgsWithEntities,
    config: DeepReadonly<IFullAppConfig>
  ) {
    const cacheConfig = config.ncgc.caching.cist;

    const types: interfaces.Newable<any>[] = [CachedCistJsonClientService];
    if ((
        args.groups
        && cacheConfig.priorities.groups.includes(CacheType.Http)
      )
      || (
        args.auditories
        && cacheConfig.priorities.auditories.includes(CacheType.Http)
      )
      || (
        args.events
        && cacheConfig.priorities.events.includes(CacheType.Http)
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
    const dispose = async () => {
      await cistClient.dispose();
    };
    bindOnExitHandler(dispose);
    const failures = new Map<EntityType, number[]>();
    if (args.auditories) {
      failures.set(
        EntityType.Rooms,
        assertRoomsResponse(await cistClient.getRoomsResponse()) ? [] : [0],
      );
    }
    let groupsResponse: Nullable<ApiGroupsResponse> = null;
    if (args.groups) {
      groupsResponse = await cistClient.getGroupsResponse();
      failures.set(
        EntityType.Groups,
        assertGroupsResponse(groupsResponse) ? [] : [0],
      );
    }
    if (args.events) {
      let groupIds: Iterable<number>;
      if (args.events.length === 0) {
        if (!groupsResponse) {
          groupsResponse = await cistClient.getGroupsResponse();
        }
        groupIds = iterate(groupsResponse.university.faculties)
          .map(f => f.directions)
          .flatten()
          .filter(d => !!d.groups)
          .map(d => d.groups as ApiGroup[])
          .flatten()
          .map(g => g.id);
      } else {
        groupIds = args.events;
      }
      const eventFailures = [];
      for (const groupId of groupIds) {
        const events = await cistClient.getEventsResponse(
          TimetableType.Group,
          groupId,
        );
        if (!assertEventsResponse(events)) {
          eventFailures.push(groupId);
        }
      }
      failures.set(EntityType.Events, eventFailures);
    }
    await cistClient.dispose();

    console.info('Results:');
    let ids = failures.get(EntityType.Rooms);
    if (ids) {
      console.info(ids.length === 0
        ? 'Auditories response is valid'
        : 'Auditories response is NOT valid');
    }
    ids = failures.get(EntityType.Groups);
    if (ids) {
      console.info(ids.length === 0
        ? 'Groups response is valid'
        : 'Groups response is NOT valid');
    }
    ids = failures.get(EntityType.Events);
    if (ids) {
      console.info(ids.length === 0
        ? 'All Events responses are valid'
        : `Responses for such Group IDs are not valid: ${toPrintString(ids)}`);
    }
    process.exit(iterate(failures.values()).every(a => a.length === 0) ? 0 : 1);
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
// //   TimetableType.Group,
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

