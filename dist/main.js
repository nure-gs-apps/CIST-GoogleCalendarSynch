"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// IMPORTANT! INSTALLS MONKEY PATCHES
require("./polyfills");
const types_1 = require("./config/types");
const container_1 = require("./di/container");
const types_2 = require("./di/types");
// initialize exit handlers
require("./services/exit-handler.service");
const cached_cist_json_client_service_1 = require("./services/cist/cached-cist-json-client.service");
const cist_json_http_client_service_1 = require("./services/cist/cist-json-http-client.service");
const assert_responses_1 = require("./utils/assert-responses");
const common_1 = require("./utils/common");
var AssertCommand;
(function (AssertCommand) {
    AssertCommand.typesArgName = "types";
    let AssertType;
    (function (AssertType) {
        AssertType["Groups"] = "groups";
        AssertType["Rooms"] = "auditories";
    })(AssertType = AssertCommand.AssertType || (AssertCommand.AssertType = {}));
    function getValidAssertTypes() {
        return Object.values(AssertType);
    }
    AssertCommand.getValidAssertTypes = getValidAssertTypes;
    function assertAssertTypes(types) {
        const validTypes = getValidAssertTypes();
        if (types.filter((t) => !validTypes.includes(t)).length !== 0) {
            throw new TypeError(`Types ${common_1.toPrintString(types)} must be within choices ${common_1.toPrintString(validTypes)}`);
        }
    }
    async function handle(args, config) {
        assertAssertTypes(args.types);
        const assertTypes = args.types;
        const cacheConfig = config.ncgc.caching.cist;
        const types = [cached_cist_json_client_service_1.CachedCistJsonClientService];
        const checkRooms = assertTypes.includes(AssertType.Rooms);
        const checkGroups = assertTypes.includes(AssertType.Groups);
        if ((checkGroups
            && cacheConfig.priorities.groups.includes(types_1.CacheType.Http))
            || (checkRooms
                && cacheConfig.priorities.auditories.includes(types_1.CacheType.Http))) {
            types.push(cist_json_http_client_service_1.CistJsonHttpClient);
        }
        const container = container_1.createContainer({
            types,
            forceNew: true
        });
        container.bind(types_2.TYPES.CistJsonClient)
            .to(cached_cist_json_client_service_1.CachedCistJsonClientService);
        await container_1.getContainerAsyncInitializer();
        const cistClient = container
            .get(types_2.TYPES.CistJsonClient);
        let failure = false;
        if (checkRooms) {
            failure = failure
                || !assert_responses_1.assertRoomsResponse(await cistClient.getRoomsResponse());
        }
        if (checkGroups) {
            failure = failure
                || !assert_responses_1.assertGroupsResponse(await cistClient.getGroupsResponse());
        }
        await cistClient.dispose();
        process.exit(failure ? 1 : 0);
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