"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// IMPORTANT! INSTALLS MONKEY PATCHES
require("./polyfills");
// import { createContainer, getContainerAsyncInitializer } from './di/container';
// import { TYPES } from './di/types';
// initialize exit handlers
require("./services/exit-handler.service");
// import { CachedCistJsonClientService } from './services/cist/cached-cist-json-client.service';
// import { CistJsonHttpClient } from './services/cist/cist-json-http-client.service';
// import {
//   assertGroupsResponse,
//   assertRoomsResponse,
// } from './utils/assert-responses';
const common_1 = require("./utils/common");
var EntityType;
(function (EntityType) {
    EntityType["Groups"] = "groups";
    EntityType["Rooms"] = "auditories";
})(EntityType = exports.EntityType || (exports.EntityType = {}));
function assertHasEntities(args) {
    if (!args.groups && !args.auditories && !args.events) {
        throw new TypeError('No entities selected. At least one of groups, auditories or events must be chosen');
    }
    return true;
}
exports.assertHasEntities = assertHasEntities;
var AssertCommand;
(function (AssertCommand) {
    AssertCommand.entitiesArgName = "entities";
    function getValidAssertTypes() {
        return Object.values(EntityType);
    }
    AssertCommand.getValidAssertTypes = getValidAssertTypes;
    function assertAssertTypes(types) {
        const validTypes = getValidAssertTypes();
        if (types.filter((t) => !validTypes.includes(t)).length !== 0) {
            throw new TypeError(`Types ${common_1.toPrintString(types)} must be within choices ${common_1.toPrintString(validTypes)}`);
        }
    }
    AssertCommand.assertAssertTypes = assertAssertTypes;
    async function handle(args, config) {
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
    AssertCommand.handle = handle;
})(AssertCommand = exports.AssertCommand || (exports.AssertCommand = {}));
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
//# sourceMappingURL=main.js.map