import { interfaces } from 'inversify';
import iterate from 'iterare';
import { DeepReadonly, IEntitiesToOperateOn, Nullable } from '../@types';
import { CacheType, IFullAppConfig } from '../config/types';
import { createContainer, getContainerAsyncInitializer } from '../di/container';
import { TYPES } from '../di/types';
import { CachedCistJsonClientService } from '../services/cist/cached-cist-json-client.service';
import { CistJsonHttpClient } from '../services/cist/cist-json-http-client.service';
import {
  ApiGroup,
  ApiGroupsResponse,
  EntityType, TimetableType,
} from '../services/cist/types';
import {
  bindOnExitHandler,
  exitGracefully,
} from '../services/exit-handler.service';
import {
  assertEventsResponse,
  assertGroupsResponse,
  assertRoomsResponse,
} from '../utils/assert-responses';
import { toPrintString } from '../utils/common';

export async function handleCistAssert(
  args: IEntitiesToOperateOn,
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
  exitGracefully(iterate(failures.values()).every(a => a.length === 0)
    ? 0
    : 1);
}
