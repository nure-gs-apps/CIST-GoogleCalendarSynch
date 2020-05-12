import { DeepReadonly, Nullable } from '../@types';
import { IMaxCacheExpiration } from '../@types/caching';
import { ASYNC_INIT } from '../@types/object';
import { TYPES } from './types';
import { getConfig } from '../config';
import { BindingScopeEnum, Container, interfaces } from 'inversify';
import {
  ICalendarConfig,


} from '../@types/services';
import { ConfigService } from '../config/config.service';
import { CistCacheConfig } from '../config/types';
import { CacheUtilsService } from '../services/caching/cache-utils.service';
import { CachedCistJsonClientService } from '../services/cist/cached-cist-json-client.service';
import { CistJsonHttpClient } from '../services/cist/cist-json-http-client.service';
import { CistJsonHttpParserService } from '../services/cist/cist-json-http-parser.service';
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
import { IGoogleAuth } from '../services/google/types';
import { RoomsService } from '../services/google/rooms.service';
import { GoogleUtilsService } from '../services/google/google-utils.service';
import {
  getQuotaLimiterFactory,
  QuotaLimiterService,
} from '../services/quota-limiter.service';
import ServiceIdentifier = interfaces.ServiceIdentifier;

let container: Nullable<Container> = null;
let boundTypes: Nullable<ReadonlySet<ServiceIdentifier<any>>> = null;

export interface ICreateContainerOptions {
  types: Iterable<interfaces.Newable<any>>;
  skip: Iterable<ServiceIdentifier<any>>;
  forceNew: boolean;
}

export function hasContainer() {
  return !!container;
}

export function createContainer(options?: Partial<ICreateContainerOptions>) {
  const { forceNew, types: typesIterable, skip: skipIterable } = Object.assign({
    forceNew: false,
    skip: [],
    types: [],
  }, options);

  if (!forceNew && container) {
    throw new TypeError('Container is already created');
  }
  const skip = new Set(skipIterable);
  const types = new Set<ServiceIdentifier<any>>(typesIterable);
  const allRequired = types.size === 0;

  const defaultScope = BindingScopeEnum.Singleton;
  container = new Container({
    defaultScope,
    autoBindInjectable: true,
  });

  if ((
    allRequired || types.has(CachedCistJsonClientService)
  ) && !skip.has(CachedCistJsonClientService)) {
    types.add(TYPES.CacheUtils);
    types.add(TYPES.CistCacheConfig);
  }

  if ((
    allRequired || types.has(CistJsonHttpClient)
  ) && !skip.has(CistJsonHttpClient)) {
    types.add(TYPES.CistBaseApiUrl);
    types.add(TYPES.CistApiKey);
    types.add(TYPES.CistJsonHttpParser);
  }

  if ((
    allRequired || (
      types.has(TYPES.CistJsonHttpClient)
      || types.has(CistJsonHttpClient)
    ) && types.has(CachedCistJsonClientService)
  ) && !skip.has(CistJsonHttpClient) && !skip.has(TYPES.CistJsonHttpClient)) {
    container.bind<CistJsonHttpClient>(TYPES.CistJsonHttpClient)
      .to(CistJsonHttpClient);
  }

  if ((
    allRequired
    || types.has(TYPES.CacheUtils)
    || types.has(CacheUtilsService)
  ) && !skip.has(CacheUtilsService) && !skip.has(TYPES.CacheUtils)) {
    container.bind<CacheUtilsService>(TYPES.CacheUtils).to(CacheUtilsService);
    types.add(TYPES.CacheMaxExpiration);
  }

  if (
    (allRequired
      || types.has(TYPES.CistJsonHttpParser)
      || types.has(CistJsonHttpParserService))
    && !skip.has(CistJsonHttpParserService)
    && !skip.has(TYPES.CistJsonHttpParser)
  ) {
    container.bind<CistJsonHttpParserService>(TYPES.CistJsonHttpParser)
      .to(CistJsonHttpParserService);
  }

  if ((
    allRequired || types.has(TYPES.CistCacheConfig)
  ) && skip.has(TYPES.CistCacheConfig)) {
    container.bind<DeepReadonly<CistCacheConfig>>(TYPES.CistCacheConfig)
      .toConstantValue(getConfig().caching.cist);
  }

  if ((
    allRequired || types.has(TYPES.CacheMaxExpiration)
  ) && skip.has(TYPES.CacheMaxExpiration)) {
    container.bind<IMaxCacheExpiration>(TYPES.CacheMaxExpiration)
      .toConstantValue(getConfig().caching.maxExpiration);
  }

  if ((
    allRequired || types.has(TYPES.CistApiKey)
  ) && skip.has(TYPES.CistApiKey)) {
    container.bind<string>(TYPES.CistApiKey).toConstantValue(
      getConfig().cist.apiKey,
    );
  }

  if ((
    allRequired || types.has(TYPES.CistBaseApiUrl)
  ) && skip.has(TYPES.CistBaseApiUrl)) {
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

  boundTypes = types;

  return container;
}

let initPromise: Nullable<Promise<any[]>> = null;
export function getContainerAsyncInitializer() {
  if (!container) {
    throw new TypeError('Container is not initialized');
  }
  if (!initPromise) {
    initPromise = getInitPromise();
  }
  return initPromise;
}

function getInitPromise() {
  if (!container || !boundTypes) {
    throw new TypeError('Container is not created');
  }
  const promises = [] as Promise<any>[];

  if (boundTypes.size === 0) {
    return Promise.resolve([]);
  }

  if (
    boundTypes.size === 0
    || boundTypes.has(TYPES.GoogleAuth)
    || boundTypes.has(GoogleAuth)
  ) {
    promises.push(
      container.get<GoogleAuth>(TYPES.GoogleAuth)[ASYNC_INIT],
    );
  }

  if (
    boundTypes.size === 0
    || boundTypes.has(CachedCistJsonClientService)
  ) {
    promises.push(container.get<CachedCistJsonClientService>(
      TYPES.CistJsonClient
    )[ASYNC_INIT]);
  }

  return Promise.all(promises);
}

export function getContainer() {
  if (!container) {
    throw new TypeError('Container is not created');
  }
  return container;
}
