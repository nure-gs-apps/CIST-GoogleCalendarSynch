import { ReadonlyDate } from 'readonly-date';
import { DeepReadonly } from '../@types';
import { IMaxCacheExpiration } from '../@types/caching';
import { TimetableType } from '../@types/cist';
import { IEntitiesToOperateOn } from '../@types/jobs';
import { IFullAppConfig } from '../config/types';
import {
  createContainer,
  disposeContainer,
  getContainerAsyncInitializer,
} from '../di/container';
import { TYPES } from '../di/types';
import { CacheUtilsService } from '../services/caching/cache-utils.service';
import {
  CachedCistJsonClientService,
  getSharedCachedCistJsonClientInstance,
} from '../services/cist/cached-cist-json-client.service';
import {
  bindOnExitHandler,
  exitGracefully,
  unbindOnExitHandler,
} from '../services/exit-handler.service';
import { toGroupIds } from '../utils/cist';
import { getCistCachedClientTypesForArgs } from '../utils/jobs';

export async function handleCistCacheExtend(
  args: IEntitiesToOperateOn,
  newExpiration: Date,
  config: DeepReadonly<IFullAppConfig>
) {
  const types = [TYPES.CacheMaxExpiration, ...getCistCachedClientTypesForArgs(
    args,
    config.ncgc.caching.cist.priorities,
  )];
  const container = createContainer({
    types,
    skip: [TYPES.CacheUtils]
  });
  bindOnExitHandler(disposeContainer);
  container.bind<CacheUtilsService>(TYPES.CacheUtils)
    .toConstantValue(new CacheUtilsServiceWithExpiration( // might be dangerous due to singleton scope
        container.get<IMaxCacheExpiration>(TYPES.CacheMaxExpiration),
        newExpiration)
    );
  container.bind<CachedCistJsonClientService>(TYPES.CistJsonClient)
    .toDynamicValue(getSharedCachedCistJsonClientInstance);
  await getContainerAsyncInitializer([CacheUtilsService]);

  const cistClient = container
    .get<CachedCistJsonClientService>(TYPES.CistJsonClient);
  const dispose = async () => {
    await cistClient.dispose();
  };
  bindOnExitHandler(dispose);

  if (args.auditories) {
    await cistClient.setRoomsCacheExpiration(newExpiration);
  }
  if (args.groups) {
    await cistClient.setGroupsCacheExpiration(newExpiration);
  }
  if (args.events) {
    let groupIds: Iterable<number>;
    if (args.events.length === 0) {
      const groupsResponse = await cistClient.getGroupsResponse();
      groupIds = toGroupIds(groupsResponse);
    } else {
      groupIds = args.events;
    }
    const promises = [];
    for (const groupId of groupIds) {
      promises.push(cistClient.setEventsCacheExpiration(
        newExpiration,
        TimetableType.Group,
        groupId,
      ));
    }
    await Promise.all(promises);
  }

  await dispose();
  unbindOnExitHandler(dispose);
  exitGracefully(0);
}

class CacheUtilsServiceWithExpiration extends CacheUtilsService {
  private readonly _maxCacheExpiration: ReadonlyDate;

  constructor(
    maxCacheExpirationConfig: IMaxCacheExpiration,
    maxCacheExpiration: ReadonlyDate,
  ) {
    super(maxCacheExpirationConfig);
    this._maxCacheExpiration = maxCacheExpiration;
  }

  getMaxExpiration(date: ReadonlyDate = new ReadonlyDate()): ReadonlyDate {
    if (date.valueOf() < this._maxCacheExpiration.valueOf()) {
      return this._maxCacheExpiration;
    }
    return super.getMaxExpiration(date);
  }
}
