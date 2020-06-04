import iterate from 'iterare';
import { DeepReadonly, GuardedMap, Nullable } from '../@types';
import { IEntitiesToOperateOn } from '../@types/jobs';
import { IInfoLogger } from '../@types/logging';
import { IFullAppConfig } from '../config/types';
import {
  createContainer,
  disposeContainer,
  getContainerAsyncInitializer,
} from '../di/container';
import { TYPES } from '../di/types';
import { CachedCistJsonClientService } from '../services/cist/cached-cist-json-client.service';
import {
  ApiGroupsResponse,
  EntityType, TimetableType,
} from '../@types/cist';
import {
  bindOnExitHandler,
  exitGracefully, unbindOnExitHandler,
} from '../services/exit-handler.service';
import {
  assertEventsResponse,
  assertGroupsResponse,
  assertRoomsResponse,
} from '../utils/assert-responses';
import { toGroupIds, toPrintString } from '../utils/common';
import { getCistCachedClientTypes } from '../utils/jobs';

export async function handleCistAssert(
  args: IEntitiesToOperateOn,
  config: DeepReadonly<IFullAppConfig>,
  logger: IInfoLogger,
) {
  const container = createContainer({
    types: getCistCachedClientTypes(args, config.ncgc.caching.cist.priorities),
    forceNew: true,
  });
  bindOnExitHandler(disposeContainer);
  container.bind<CachedCistJsonClientService>(TYPES.CistJsonClient)
    .to(CachedCistJsonClientService);
  await getContainerAsyncInitializer([CachedCistJsonClientService]);

  const cistClient = container
    .get<CachedCistJsonClientService>(TYPES.CistJsonClient);
  const dispose = async () => {
    await cistClient.dispose();
  };
  bindOnExitHandler(dispose);
  const failures = new GuardedMap<EntityType, number[]>();
  if (args.auditories) {
    failures.set(
      EntityType.Rooms,
      assertRoomsResponse(await cistClient.getRoomsResponse(), logger)
        ? []
        : [0],
    );
  }
  let groupsResponse: Nullable<ApiGroupsResponse> = null;
  if (args.groups) {
    groupsResponse = await cistClient.getGroupsResponse();
    failures.set(
      EntityType.Groups,
      assertGroupsResponse(groupsResponse, logger) ? [] : [0],
    );
  }
  if (args.events) {
    let groupIds: Iterable<number>;
    if (args.events.length === 0) {
      if (!groupsResponse) {
        groupsResponse = await cistClient.getGroupsResponse();
      }
      groupIds = toGroupIds(groupsResponse);
    } else {
      groupIds = args.events;
    }
    const eventFailures = [];
    for (const groupId of groupIds) {
      const events = await cistClient.getEventsResponse(
        TimetableType.Group,
        groupId,
      );
      if (!assertEventsResponse(events, logger)) {
        eventFailures.push(groupId);
      }
    }
    failures.set(EntityType.Events, eventFailures);
  }
  await cistClient.dispose();

  logger.info('Results:');
  let ids = failures.get(EntityType.Rooms);
  if (ids) {
    logger.info(ids.length === 0
      ? 'Auditories response is valid'
      : 'Auditories response is NOT valid');
  }
  ids = failures.get(EntityType.Groups);
  if (ids) {
    logger.info(ids.length === 0
      ? 'Groups response is valid'
      : 'Groups response is NOT valid');
  }
  ids = failures.get(EntityType.Events);
  if (ids) {
    logger.info(ids.length === 0
      ? 'All Events responses are valid'
      : `Responses for such Group IDs are not valid: ${toPrintString(ids)}`);
  }
  await dispose();
  unbindOnExitHandler(dispose);
  exitGracefully(iterate(failures.values()).every(a => a.length === 0)
    ? 0
    : 1);
}
