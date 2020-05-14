import { DeepReadonly, Nullable } from '../@types';
import { IMaxCacheExpiration } from '../@types/caching';
import { ILogger } from '../@types/logging';
import { ASYNC_INIT } from '../@types/object';
import { GoogleAuthAdminDirectory } from '../services/google/google-auth-admin-directory';
import { logger } from '../services/logger.service';
import { TYPES } from './types';
import { getConfig } from '../config';
import { BindingScopeEnum, Container, interfaces } from 'inversify';
import { IApiQuota, ICalendarConfig } from '../@types/services';
import { ConfigService } from '../config/config.service';
import {
  CistCacheConfig,
  GoogleAuthConfigKey,
} from '../config/types';
import { CacheUtilsService } from '../services/caching/cache-utils.service';
import { CachedCistJsonClientService } from '../services/cist/cached-cist-json-client.service';
import { CistJsonHttpClient } from '../services/cist/cist-json-http-client.service';
import { CistJsonHttpParserService } from '../services/cist/cist-json-http-parser.service';
import { BuildingsService } from '../services/google/buildings.service';
import { CalendarService } from '../services/google/calendar.service';
import { EventsService } from '../services/google/events.service';
import { GoogleApiCalendar } from '../services/google/google-api-calendar';
import { GoogleApiAdminDirectory } from '../services/google/google-api-admin-directory';
import { GroupsService } from '../services/google/groups.service';
import { RoomsService } from '../services/google/rooms.service';
import { GoogleUtilsService } from '../services/google/google-utils.service';
import {
  getQuotaLimiterFactory,
  QuotaLimiterService,
} from '../services/quota-limiter.service';
import ServiceIdentifier = interfaces.ServiceIdentifier;
import { IGoogleAuth } from '../services/google/google-auth';

let container: Nullable<Container> = null;
let boundTypes: Nullable<ReadonlySet<ServiceIdentifier<any>>> = null;

export interface ICreateContainerOptions {
  types: Iterable<ServiceIdentifier<any>>;
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
    ) && !types.has(CachedCistJsonClientService)
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

  if (
    (allRequired
      || types.has(TYPES.BuildingsService)
      || types.has(BuildingsService))
    && !skip.has(BuildingsService)
    && !skip.has(TYPES.BuildingsService)
  ) {
    container.bind<BuildingsService>(TYPES.BuildingsService)
      .to(BuildingsService);
    types.add(TYPES.GoogleApiAdminDirectory);
    types.add(TYPES.GoogleAdminDirectoryQuotaLimiter);
    types.add(TYPES.GoogleUtils);
    types.add(TYPES.Logger);
  }

  if (
    (allRequired
      || types.has(TYPES.RoomsService)
      || types.has(RoomsService))
    && !skip.has(RoomsService)
    && !skip.has(TYPES.RoomsService)
  ) {
    container.bind<RoomsService>(TYPES.RoomsService)
      .to(RoomsService);
    types.add(TYPES.GoogleApiAdminDirectory);
    types.add(TYPES.GoogleAdminDirectoryQuotaLimiter);
    types.add(TYPES.GoogleUtils);
    types.add(TYPES.Logger);
  }

  if (
    (allRequired
      || types.has(TYPES.GroupsService)
      || types.has(GroupsService))
    && !skip.has(GroupsService)
    && !skip.has(TYPES.GroupsService)
  ) {
    container.bind<GroupsService>(TYPES.GroupsService)
      .to(GroupsService);
    types.add(TYPES.GoogleApiAdminDirectory);
    types.add(TYPES.GoogleAdminDirectoryQuotaLimiter);
    types.add(TYPES.GoogleUtils);
    types.add(TYPES.Logger);
  }

  if (
    (allRequired
      || types.has(TYPES.GoogleApiAdminDirectory)
      || types.has(GoogleApiAdminDirectory))
    && !skip.has(GoogleApiAdminDirectory)
    && !skip.has(TYPES.GoogleApiAdminDirectory)
  ) {
    container.bind<GoogleApiAdminDirectory>(TYPES.GoogleApiAdminDirectory)
      .to(GoogleApiAdminDirectory);
    types.add(TYPES.GoogleAuthAdminDirectory);
  }

  if (
    (allRequired
      || types.has(TYPES.GoogleAuthAdminDirectory)
      || types.has(GoogleAuthAdminDirectory))
    && !skip.has(GoogleAuthAdminDirectory)
    && !skip.has(TYPES.GoogleAuthAdminDirectory)
  ) {
    container.bind<IGoogleAuth>(TYPES.GoogleAuthAdminDirectory)
      .to(GoogleAuthAdminDirectory);
    types.add(TYPES.Logger);
    types.add(TYPES.GoogleAuthAdminDirectoryKey);
  }

  if ((
    allRequired || types.has(TYPES.GoogleAdminDirectoryQuotaLimiter)
  ) && !skip.has(TYPES.GoogleAdminDirectoryQuotaLimiter)) {
    container.bind<QuotaLimiterService>(TYPES.GoogleAdminDirectoryQuotaLimiter)
      .toDynamicValue(getQuotaLimiterFactory(
        TYPES.GoogleAdminDirectoryQuotaLimiterConfig,
        defaultScope === BindingScopeEnum.Singleton,
      ));
    types.add(TYPES.GoogleAdminDirectoryQuotaLimiterConfig);
  }

  if ((
    allRequired || types.has(TYPES.GoogleCalendarQuotaLimiter)
  ) && !skip.has(TYPES.GoogleCalendarQuotaLimiter)) {
    container.bind<QuotaLimiterService>(TYPES.GoogleCalendarQuotaLimiter)
      .toDynamicValue(getQuotaLimiterFactory(
        TYPES.GoogleCalendarQuotaLimiterConfig,
        defaultScope === BindingScopeEnum.Singleton,
      ));
    types.add(TYPES.GoogleCalendarQuotaLimiterConfig);
  }

  if (
    (allRequired
      || types.has(TYPES.GoogleUtils)
      || types.has(GoogleUtilsService))
    && !skip.has(GoogleUtilsService)
    && !skip.has(TYPES.GoogleUtils)
  ) {
    container.bind<GoogleUtilsService>(TYPES.GoogleUtils)
      .to(GoogleUtilsService);
    types.add(TYPES.GoogleAuthSubject);
    types.add(TYPES.GoogleEntityIdPrefix);
  }

  if ((
    allRequired || types.has(TYPES.Logger)
  ) && !skip.has(TYPES.Logger)) {
    container.bind<ILogger>(TYPES.Logger).toConstantValue(logger);
  }

  // Constants

  if ((
    allRequired || types.has(TYPES.CistCacheConfig)
  ) && !skip.has(TYPES.CistCacheConfig)) {
    container.bind<DeepReadonly<CistCacheConfig>>(TYPES.CistCacheConfig)
      .toConstantValue(getConfig().caching.cist);
  }

  if ((
    allRequired || types.has(TYPES.CacheMaxExpiration)
  ) && !skip.has(TYPES.CacheMaxExpiration)) {
    container.bind<IMaxCacheExpiration>(TYPES.CacheMaxExpiration)
      .toConstantValue(getConfig().caching.maxExpiration);
  }

  if ((
    allRequired || types.has(TYPES.CistApiKey)
  ) && !skip.has(TYPES.CistApiKey)) {
    container.bind<string>(TYPES.CistApiKey).toConstantValue(
      getConfig().cist.apiKey,
    );
  }

  if ((
    allRequired || types.has(TYPES.CistBaseApiUrl)
  ) && !skip.has(TYPES.CistBaseApiUrl)) {
    container.bind<string>(TYPES.CistBaseApiUrl).toConstantValue(
      getConfig().cist.baseUrl,
    );
  }

  if ((
    allRequired || types.has(TYPES.GoogleAuthAdminDirectoryKey)
  ) && !skip.has(TYPES.GoogleAuthAdminDirectoryKey)) {
    container.bind<GoogleAuthConfigKey>(TYPES.GoogleAuthAdminDirectoryKey)
      .toConstantValue(getConfig().google.auth.adminDirectoryKey);
  }

  if ((
    allRequired || types.has(TYPES.GoogleAuthSubject)
  ) && !skip.has(TYPES.GoogleAuthSubject)) {
    container.bind<string>(TYPES.GoogleAuthSubject).toConstantValue(
      getConfig().google.auth.subjectEmail,
    );
  }

  if ((
    allRequired || types.has(TYPES.GoogleEntityIdPrefix)
  ) && !skip.has(TYPES.GoogleEntityIdPrefix)) {
    container.bind<Nullable<string>>(
      TYPES.GoogleEntityIdPrefix
    ).toConstantValue(getConfig().google.idPrefix);
  }

  if ((
    allRequired || types.has(TYPES.GoogleAdminDirectoryQuotaLimiterConfig)
  ) && !skip.has(TYPES.GoogleAdminDirectoryQuotaLimiterConfig)) {
    container.bind<IApiQuota>(
      TYPES.GoogleAdminDirectoryQuotaLimiterConfig
    ).toConstantValue(getConfig().google.quotas.adminDirectoryApi);
  }

  if ((
    allRequired || types.has(TYPES.GoogleCalendarQuotaLimiterConfig)
  ) && !skip.has(TYPES.GoogleCalendarQuotaLimiterConfig)) {
    container.bind<IApiQuota>(
      TYPES.GoogleCalendarQuotaLimiterConfig
    ).toConstantValue(getConfig().google.quotas.calendarApi);
  }

  // Unchecked
  container.bind<ICalendarConfig>(TYPES.GoogleCalendarConfig).toConstantValue(
    getConfig().google.calendar,
  );

  container.bind<GoogleApiCalendar>(TYPES.GoogleApiCalendar)
    .to(GoogleApiCalendar);

  container.bind<RoomsService>(TYPES.RoomsService).to(RoomsService);
  container.bind<GroupsService>(TYPES.GroupsService).to(GroupsService);

  container.bind<CalendarService>(TYPES.CalendarService).to(CalendarService);
  container.bind<EventsService>(TYPES.EventsService).to(EventsService);

  container.bind<ConfigService>(TYPES.Config).to(ConfigService);

  boundTypes = types;

  return container;
}

let initPromise: Nullable<Promise<any[]>> = null;
export function getContainerAsyncInitializer(
  additionalTypes?: Iterable<ServiceIdentifier<any>>
) {
  if (!container) {
    throw new TypeError('Container is not initialized');
  }
  if (!initPromise) {
    initPromise = getInitPromise();
  }
  const types = new Set(additionalTypes);
  return types.size === 0 ? initPromise : getInitPromise(types);
}

function getInitPromise(types = boundTypes) {
  if (!container || !types) {
    throw new TypeError('Container is not created');
  }
  const promises = [] as Promise<any>[];

  if (types.size === 0) {
    return Promise.resolve([]);
  }

  if (
    types.size === 0
    || types.has(TYPES.GoogleAuthAdminDirectory)
    || types.has(GoogleAuthAdminDirectory)
  ) {
    promises.push(container.get<GoogleAuthAdminDirectory>(
      TYPES.GoogleAuthAdminDirectory
    )[ASYNC_INIT]);
  }

  if (
    types.size === 0
    || types.has(CachedCistJsonClientService)
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
