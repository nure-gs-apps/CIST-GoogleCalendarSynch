import iterate from 'iterare';
import { Arguments, Argv } from 'yargs';
import { DeepPartial, DeepReadonly } from '../@types';
import { IEntitiesToOperateOn } from '../@types/jobs';
import { IWarnLogger } from '../@types/logging';
import { IFullAppConfig } from '../config/types';
import { IEntitiesToRemove } from '../jobs/sync.class';
import { toPrintString } from '../utils/common';

export interface IArgsWithEntities extends Arguments<DeepPartial<IFullAppConfig>>, IEntitiesToOperateOn {
}

export function assertHasEntities(args: DeepReadonly<IArgsWithEntities>) {
  if (!args.groups && !args.auditories && !args.events) {
    throw new TypeError('No entities selected. At least one of groups, auditories or events must be chosen');
  }
  return true;
}

export function addEntitiesOptions<T extends DeepPartial<IFullAppConfig> =  DeepPartial<IFullAppConfig>>(
  yargs: Argv<T>,
  demand = true,
  logger: IWarnLogger = console,
): Argv<T & IEntitiesToOperateOn> {
  const groupsName = nameof<IEntitiesToOperateOn>(e => e.groups);
  const auditoriesName = nameof<IEntitiesToOperateOn>(e => e.auditories);
  const eventsName = nameof<IEntitiesToOperateOn>(e => e.events);
  let builder = yargs
    .option(groupsName, {
      alias: groupsName[0],
      description: 'Operate on groups',
      type: 'boolean'
    })
    .option(auditoriesName, {
      alias: auditoriesName[0],
      description: 'Operate on auditories',
      type: 'boolean'
    })
    .option(eventsName, {
      alias: eventsName[0],
      description: 'Operate on events. Supply "all", "" or nothing for all events. Supply list of coma-separated (no spaces) Group IDs to fetch events for',
      type: 'string',
      coerce(value: any) {
        const str = value as string;
        if (str === '' || str === 'all') {
          return [];
        }
        if (!value) {
          return null;
        }
        const initialArgs = str.split(/\s*,\s*/);
        const ids = iterate(initialArgs)
          .map(v => Number.parseInt(v, 10))
          .filter(v => !Number.isNaN(v))
          .toArray();
        if (ids.length === 0) {
          throw new TypeError('No Group IDs parsed');
        }
        if (initialArgs.length !== ids.length) {
          logger.warn(`Only such IDs found: ${toPrintString(ids)}`);
        }
        return ids;
      },
      requiresArg: false,
    });
  if (demand) {
    builder = builder.check(
      args => assertHasEntities(args as any)
    );
  }
  return builder as any;
}

export function addEntitiesToRemoveOptions<T extends DeepPartial<IFullAppConfig> = DeepPartial<IFullAppConfig>>(
  yargs: Argv<T>,
): Argv<T & IEntitiesToRemove> {
  const buildingsName = nameof<IEntitiesToRemove>(
    e => e.deleteIrrelevantBuildings,
  );
  const auditoriesName = nameof<IEntitiesToRemove>(
    e => e.deleteIrrelevantAuditories,
  );
  const groupsName = nameof<IEntitiesToRemove>(
    e => e.deleteIrrelevantGroups,
  );
  const eventsName = nameof<IEntitiesToRemove>(
    e => e.deleteIrrelevantEvents,
  );
  return yargs
    .option(buildingsName, {
      description: 'Delete irrelevant buildings, that are not found in current CIST Auditories response',
      type: 'boolean',
    })
    .option(auditoriesName, {
      description: 'Delete irrelevant auditories, that are not found in current CIST Auditories response',
      type: 'boolean',
    })
    .option(groupsName, {
      description: 'Delete irrelevant groups, that are not found in current CIST Groups response',
      type: 'boolean',
    })
    .option(eventsName, {
      description: 'Delete irrelevant events, that are not found in current CIST Events responses',
      type: 'boolean',
    }) as any;
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
