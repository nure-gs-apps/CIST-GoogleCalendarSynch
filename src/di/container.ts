import { TYPES } from './types';
import { getConfig } from '../config';
import { BindingScopeEnum, Container, interfaces } from 'inversify';
import {
  ASYNC_INIT,
  DeepReadonly,
  ICalendarConfig,
  IMaxCacheExpiration,
  Nullable,
} from '../@types';
import { ConfigService } from '../config/config.service';
import { CistCacheConfig } from '../config/types';
import { CacheUtilsService } from '../services/cache-utils.service';
import { CachedCistJsonClientService } from '../services/cist/cached-cist-json-client.service';
import { CistJsonHttpClient } from '../services/cist/cist-json-http-client.service';
import { CistJsonHttpUtilsService } from '../services/cist/cist-json-http-utils.service';
import { BuildingsService } from '../services/google/buildings.service';
import { CalendarService } from '../services/google/calendar.service';
import {
  calenderAuthScopes,
  directoryAuthScopes,
} from '../services/google/constants';
import { EventsService } from '../services/google/events.service';
import { GoogleApiCalendar } from '../services/google/google-api-calendar';
import { GoogleAuth } from '../services/google/google-auth';
import { GoogleApiDirectory } from '../services/google/google-api-directory';
import { GroupsService } from '../services/google/groups.service';
import { IGoogleAuth } from '../services/google/interfaces';
import { RoomsService } from '../services/google/rooms.service';
import { GoogleUtilsService } from '../services/google/google-utils.service';
import {
  getQuotaLimiterFactory,
  QuotaLimiterService,
} from '../services/quota-limiter.service';
import ServiceIdentifier = interfaces.ServiceIdentifier;

let container: Nullable<Container> = null;

export interface ICreateContainerOptions {
  types: Iterable<interfaces.Newable<any>>;
  forceNew: boolean;
}

export function hasContainer() {
  return !!container;
}

export function createContainer(options?: Partial<ICreateContainerOptions>) {
  const { forceNew, types: typesIterable } = Object.assign({
    forceNew: false,
    types: [],
  }, options);

  if (!forceNew && container) {
    throw new TypeError('Container is already created');
  }
  const types = new Set<ServiceIdentifier<any>>(typesIterable);
  const allRequired = types.size === 0;

  const defaultScope = BindingScopeEnum.Singleton;
  container = new Container({
    defaultScope,
    autoBindInjectable: true,
  });

  if (allRequired || types.has(CachedCistJsonClientService)) {
    types.add(TYPES.CacheUtils);
    types.add(TYPES.CistCacheConfig);
  }

  if (
    allRequired
    || types.has(TYPES.CacheUtils)
    || types.has(CacheUtilsService)
  ) {
    container.bind<CacheUtilsService>(TYPES.CacheUtils).to(CacheUtilsService);
    types.add(TYPES.CacheMaxExpiration);
  }

  if (
    allRequired
    || types.has(TYPES.CistJsonHttpClient)
    || types.has(CistJsonHttpClient)
  ) {
    container.bind<CistJsonHttpClient>(TYPES.CistJsonHttpClient)
      .to(CistJsonHttpClient);
  }

  if (
    allRequired
    || types.has(TYPES.CistJsonHttpUtils)
    || types.has(CistJsonHttpUtilsService)
  ) {
    container.bind<CistJsonHttpUtilsService>(TYPES.CistJsonHttpUtils)
      .to(CistJsonHttpUtilsService);
  }

  if (
    allRequired
    || types.has(TYPES.CistCacheConfig)
  ) {
    container.bind<DeepReadonly<CistCacheConfig>>(TYPES.CistCacheConfig)
      .toConstantValue(getConfig().caching.cist);
  }

  if (
    allRequired
    || types.has(TYPES.CacheMaxExpiration)
  ) {
    container.bind<IMaxCacheExpiration>(TYPES.CacheMaxExpiration)
      .toConstantValue(getConfig().caching.maxExpiration);
  }

  if (
    allRequired
    || types.has(TYPES.CistApiKey)
  ) {
    container.bind<string>(TYPES.CistApiKey).toConstantValue(
      getConfig().cist.apiKey,
    );
  }

  if (
    allRequired
    || types.has(TYPES.CistBaseApiUrl)
  ) {
    container.bind<string>(TYPES.CistBaseApiUrl).toConstantValue(
      getConfig().cist.baseUrl,
    );
  }

  container.bind<string>(TYPES.GoogleAuthSubject).toConstantValue(
    getConfig().google.auth.subjectEmail,
  );

  container.bind<string>(TYPES.GoogleAuthKeyFilepath)
    .toConstantValue(
      getConfig().google.auth.keyFilepath // TODO: clarify configuration
      // tslint:disable-next-line:no-non-null-assertion
        || process.env.GOOGLE_APPLICATION_CREDENTIALS!,
    );
  container.bind<ReadonlyArray<string>>(TYPES.GoogleAuthScopes)
    .toConstantValue(directoryAuthScopes.concat(calenderAuthScopes));
  container.bind<ICalendarConfig>(TYPES.GoogleCalendarConfig).toConstantValue(
    getConfig().google.calendar,
  );

  container.bind<IGoogleAuth>(TYPES.GoogleAuth)
    .to(GoogleAuth);

  container.bind<QuotaLimiterService>(TYPES.GoogleDirectoryQuotaLimiter)
    .toDynamicValue(getQuotaLimiterFactory(
      getConfig().google.quotas.directoryApi,
      defaultScope === BindingScopeEnum.Singleton,
    ));
  container.bind<QuotaLimiterService>(TYPES.GoogleCalendarQuotaLimiter)
    .toDynamicValue(getQuotaLimiterFactory(
      getConfig().google.quotas.calendarApi,
      defaultScope === BindingScopeEnum.Singleton,
    ));

  container.bind<GoogleApiDirectory>(TYPES.GoogleApiDirectory)
    .to(GoogleApiDirectory);
  container.bind<GoogleApiCalendar>(TYPES.GoogleApiCalendar)
    .to(GoogleApiCalendar);

  container.bind<BuildingsService>(TYPES.BuildingsService)
    .to(BuildingsService);
  container.bind<RoomsService>(TYPES.RoomsService).to(RoomsService);
  container.bind<GroupsService>(TYPES.GroupsService).to(GroupsService);

  container.bind<CalendarService>(TYPES.CalendarService).to(CalendarService);
  container.bind<EventsService>(TYPES.EventsService).to(EventsService);

  container.bind<GoogleUtilsService>(TYPES.GoogleUtils).to(GoogleUtilsService);
  container.bind<ConfigService>(TYPES.Config).to(ConfigService);

  setInitPromise(types);

  return container;
}

function setInitPromise(types: ReadonlySet<ServiceIdentifier<any>>) {
  if (!container) {
    throw new TypeError('Container is not created');
  }
  const promises = [] as Promise<any>[];

  if (
    types.size === 0
    || types.has(TYPES.GoogleAuth)
    || types.has(GoogleAuth)
  ) {
    promises.push(
      container.get<GoogleAuth>(TYPES.GoogleAuth)[ASYNC_INIT],
    );
  }

  if (types.size === 0 || types.has(CachedCistJsonClientService)) {
    promises.push(container.get<CachedCistJsonClientService>(
      TYPES.CistJsonClient
    )[ASYNC_INIT]);
  }

  initPromise = Promise.all(promises);
}

export function getContainer() {
  if (!container) {
    throw new TypeError('Container is not created');
  }
  return container;
}

let initPromise: Nullable<Promise<any[]>> = null;
export function getAsyncInitializer() {
  if (!container || !initPromise) {
    throw new TypeError('Container is not initialized');
  }
  return initPromise;
}
