"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const iterare_1 = require("iterare");
const types_1 = require("../config/types");
const container_1 = require("../di/container");
const types_2 = require("../di/types");
const cached_cist_json_client_service_1 = require("../services/cist/cached-cist-json-client.service");
const cist_json_http_client_service_1 = require("../services/cist/cist-json-http-client.service");
const types_3 = require("../services/cist/types");
const exit_handler_service_1 = require("../services/exit-handler.service");
const assert_responses_1 = require("../utils/assert-responses");
const common_1 = require("../utils/common");
async function handleCistAssert(args, config) {
    const cacheConfig = config.ncgc.caching.cist;
    const types = [cached_cist_json_client_service_1.CachedCistJsonClientService];
    if ((args.groups
        && cacheConfig.priorities.groups.includes(types_1.CacheType.Http))
        || (args.auditories
            && cacheConfig.priorities.auditories.includes(types_1.CacheType.Http))
        || (args.events
            && cacheConfig.priorities.events.includes(types_1.CacheType.Http))) {
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
    const dispose = async () => {
        await cistClient.dispose();
    };
    exit_handler_service_1.bindOnExitHandler(dispose);
    const failures = new Map();
    if (args.auditories) {
        failures.set(types_3.EntityType.Rooms, assert_responses_1.assertRoomsResponse(await cistClient.getRoomsResponse()) ? [] : [0]);
    }
    let groupsResponse = null;
    if (args.groups) {
        groupsResponse = await cistClient.getGroupsResponse();
        failures.set(types_3.EntityType.Groups, assert_responses_1.assertGroupsResponse(groupsResponse) ? [] : [0]);
    }
    if (args.events) {
        let groupIds;
        if (args.events.length === 0) {
            if (!groupsResponse) {
                groupsResponse = await cistClient.getGroupsResponse();
            }
            groupIds = iterare_1.default(groupsResponse.university.faculties)
                .map(f => f.directions)
                .flatten()
                .filter(d => !!d.groups)
                .map(d => d.groups)
                .flatten()
                .map(g => g.id);
        }
        else {
            groupIds = args.events;
        }
        const eventFailures = [];
        for (const groupId of groupIds) {
            const events = await cistClient.getEventsResponse(types_3.TimetableType.Group, groupId);
            if (!assert_responses_1.assertEventsResponse(events)) {
                eventFailures.push(groupId);
            }
        }
        failures.set(types_3.EntityType.Events, eventFailures);
    }
    await cistClient.dispose();
    console.info('Results:');
    let ids = failures.get(types_3.EntityType.Rooms);
    if (ids) {
        console.info(ids.length === 0
            ? 'Auditories response is valid'
            : 'Auditories response is NOT valid');
    }
    ids = failures.get(types_3.EntityType.Groups);
    if (ids) {
        console.info(ids.length === 0
            ? 'Groups response is valid'
            : 'Groups response is NOT valid');
    }
    ids = failures.get(types_3.EntityType.Events);
    if (ids) {
        console.info(ids.length === 0
            ? 'All Events responses are valid'
            : `Responses for such Group IDs are not valid: ${common_1.toPrintString(ids)}`);
    }
    exit_handler_service_1.exitGracefully(iterare_1.default(failures.values()).every(a => a.length === 0)
        ? 0
        : 1);
}
exports.handleCistAssert = handleCistAssert;
//# sourceMappingURL=cist-assert.js.map