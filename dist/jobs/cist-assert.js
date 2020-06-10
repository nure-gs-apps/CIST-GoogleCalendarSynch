"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const iterare_1 = require("iterare");
const _types_1 = require("../@types");
const container_1 = require("../di/container");
const types_1 = require("../di/types");
const cached_cist_json_client_service_1 = require("../services/cist/cached-cist-json-client.service");
const cist_1 = require("../@types/cist");
const exit_handler_service_1 = require("../services/exit-handler.service");
const assert_responses_1 = require("../utils/assert-responses");
const cist_2 = require("../utils/cist");
const common_1 = require("../utils/common");
const jobs_1 = require("../utils/jobs");
async function handleCistAssert(args, config, logger) {
    const container = container_1.createContainer({
        types: jobs_1.getCistCachedClientTypesForArgs(args, config.ncgc.caching.cist.priorities),
        forceNew: true,
    });
    exit_handler_service_1.bindOnExitHandler(container_1.disposeContainer);
    container.bind(types_1.TYPES.CistJsonClient)
        .toDynamicValue(cached_cist_json_client_service_1.getSharedCachedCistJsonClientInstance);
    await container_1.getContainerAsyncInitializer([cached_cist_json_client_service_1.CachedCistJsonClientService]);
    const cistClient = container
        .get(types_1.TYPES.CistJsonClient);
    const dispose = async () => {
        await cistClient.dispose();
    };
    exit_handler_service_1.bindOnExitHandler(dispose);
    const failures = new _types_1.GuardedMap();
    if (args.auditories) {
        failures.set(cist_1.EntityType.Rooms, assert_responses_1.assertRoomsResponse(await cistClient.getRoomsResponse(), logger)
            ? []
            : [0]);
    }
    let groupsResponse = null;
    if (args.groups) {
        groupsResponse = await cistClient.getGroupsResponse();
        failures.set(cist_1.EntityType.Groups, assert_responses_1.assertGroupsResponse(groupsResponse, logger) ? [] : [0]);
    }
    if (args.events) {
        let groupIds;
        if (args.events.length === 0) {
            if (!groupsResponse) {
                groupsResponse = await cistClient.getGroupsResponse();
            }
            groupIds = cist_2.toGroupIds(groupsResponse);
        }
        else {
            groupIds = args.events;
        }
        const eventFailures = [];
        for (const groupId of groupIds) {
            const events = await cistClient.getEventsResponse(cist_1.TimetableType.Group, groupId);
            if (!assert_responses_1.assertEventsResponse(events, logger)) {
                eventFailures.push(groupId);
            }
        }
        failures.set(cist_1.EntityType.Events, eventFailures);
    }
    logger.info('Results:');
    let ids = failures.get(cist_1.EntityType.Rooms);
    if (ids) {
        logger.info(ids.length === 0
            ? 'Auditories response is valid'
            : 'Auditories response is NOT valid');
    }
    ids = failures.get(cist_1.EntityType.Groups);
    if (ids) {
        logger.info(ids.length === 0
            ? 'Groups response is valid'
            : 'Groups response is NOT valid');
    }
    ids = failures.get(cist_1.EntityType.Events);
    if (ids) {
        logger.info(ids.length === 0
            ? 'All Events responses are valid'
            : `Responses for such Group IDs are not valid: ${common_1.toPrintString(ids)}`);
    }
    await dispose();
    exit_handler_service_1.unbindOnExitHandler(dispose);
    exit_handler_service_1.exitGracefully(iterare_1.default(failures.values()).every(a => a.length === 0)
        ? 0
        : 1);
}
exports.handleCistAssert = handleCistAssert;
//# sourceMappingURL=cist-assert.js.map