import { BindingScopeEnum, Container, interfaces } from 'inversify';
import { DeepReadonly, Nullable } from '../@types';
import { IMaxCacheExpiration } from '../@types/caching';
import { ILogger } from '../@types/logging';
import { ASYNC_INIT, IDisposable } from '../@types/object';
import { IApiQuota, ICalendarConfig } from '../@types/services';
import {
  ITaskProgressBackend,
  ITaskStepExecutor,
  TaskProgressBackend,
} from '../@types/tasks';
import { getConfig } from '../config';
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
import { GoogleApiAdminDirectory } from '../services/google/google-api-admin-directory';
import { GoogleApiCalendar } from '../services/google/google-api-calendar';
import { IGoogleAuth } from '../services/google/google-auth';
import { GoogleAuthAdminDirectory } from '../services/google/google-auth-admin-directory';
import { GoogleAuthCalendar } from '../services/google/google-auth-calendar';
import { GoogleUtilsService } from '../services/google/google-utils.service';
import { GroupsService } from '../services/google/groups.service';
import { RoomsService } from '../services/google/rooms.service';
import { logger } from '../services/logger.service';
import {
  getQuotaLimiterFactory,
  QuotaLimiterService,
} from '../services/quota-limiter.service';
import {
  getTaskProgressBackend,
  getTaskProgressBackendSymbol,
} from '../tasks/progress/di';
import { TaskProgressFileBackend } from '../tasks/progress/file';
import { TaskStepExecutor } from '../tasks/task-step-executor';
import { PathUtils } from '../utils/common';
import { IContainer, TYPES } from './types';
import ServiceIdentifier = interfaces.ServiceIdentifier;

const defaultScope = BindingScopeEnum.Singleton;

let container: Nullable<Container> = null;
let boundTypes: Nullable<Set<ServiceIdentifier<any>>> = null;
let initPromise: Nullable<Promise<any[]>> = null;
let disposeCallbacks: Nullable<(() => Promise<any>)[]> = null;
let disposing: Nullable<Promise<any>> = null;

export interface ICreateContainerOptions extends IAddContainerTypesOptions {
  forceNew: boolean;
}

export interface IAddContainerTypesOptions {
  types: Iterable<ServiceIdentifier<any>>;
  skip: Iterable<ServiceIdentifier<any>>;
}

export function hasContainer() {
  return !!container;
}

export function createContainer(options?: Partial<ICreateContainerOptions>) {
  const fullOptions = Object.assign({
    forceNew: false,
  }, options);

  if (!fullOptions.forceNew && container) {
    throw new TypeError('Container is already created');
  }

  container = new Container({
    defaultScope,
    autoBindInjectable: true,
  });
  addTypesToContainer(options);
  disposeCallbacks = [];

  return container;
}

export function addTypesToContainer(
  options?: Partial<IAddContainerTypesOptions>
) {
  if (!container) {
    throw new TypeError('Container is not initialized');
  }
  const { types: typesIterable, skip: skipIterable } = Object.assign({
    forceNew: false,
    skip: [],
    types: [],
  }, options);
  const skip = new Set(skipIterable);
  const types = new Set<ServiceIdentifier<any>>(typesIterable);
  const allRequired = types.size === 0;

  if ((
    allRequired
    || types.has(TYPES.TaskStepExecutor)
    || types.has(TaskStepExecutor)
  ) && !skip.has(TaskStepExecutor) && !skip.has(TYPES.TaskStepExecutor)) {
    container.bind<ITaskStepExecutor>(TYPES.TaskStepExecutor)
      .to(TaskStepExecutor)
      .onActivation(
        (context, injectable) => addDisposable(
          context,
          injectable as TaskStepExecutor,
        )
      );
    types.add(TYPES.Container);
    types.add(TYPES.Logger);
  }

  if ((
    allRequired
    || types.has(TYPES.TaskProgressBackend)
  ) && !skip.has(TYPES.TaskProgressBackend)) {
    container.bind<ITaskProgressBackend>(TYPES.TaskProgressBackend)
      .toDynamicValue(getTaskProgressBackend);
    types.add(TYPES.TaskProgressBackendType);
  }

  if ((
    allRequired
    || types.has(TYPES.TaskProgressBackendType)
  ) && !skip.has(TYPES.TaskProgressBackendType)) {
    container.bind<string>(TYPES.TaskProgressBackendType)
      .toConstantValue(getConfig().tasks.progress.backend);
    types.add(getTaskProgressBackendSymbol(getConfig().tasks.progress.backend));
  }

  if ((
    allRequired
    || types.has(TYPES.TaskProgressFileBackend)
  ) && !skip.has(TYPES.TaskProgressFileBackend)) {
    container.bind<ITaskProgressBackend>(TYPES.TaskProgressFileBackend)
      .to(TaskProgressFileBackend);
    types.add(TYPES.TaskProgressFileBackendFileName);
  }

  if ((
    allRequired || types.has(CachedCistJsonClientService)
  ) && !skip.has(CachedCistJsonClientService)) {
    container.bind<CachedCistJsonClientService>(CachedCistJsonClientService)
      .to(CachedCistJsonClientService)
      .onActivation(addDisposable);
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
      || types.has(TYPES.EventsService)
      || types.has(EventsService))
    && !skip.has(EventsService)
    && !skip.has(TYPES.EventsService)
  ) {
    container.bind<EventsService>(TYPES.EventsService)
      .to(EventsService);
    types.add(TYPES.GoogleApiCalendar);
    types.add(TYPES.GoogleCalendarQuotaLimiterConfig);
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
      || types.has(TYPES.GoogleApiCalendar)
      || types.has(GoogleApiCalendar))
    && !skip.has(GoogleApiCalendar)
    && !skip.has(TYPES.GoogleApiCalendar)
  ) {
    container.bind<GoogleApiCalendar>(TYPES.GoogleApiCalendar)
      .to(GoogleApiCalendar);
    types.add(TYPES.GoogleAuthCalendar);
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

  if (
    (allRequired
      || types.has(TYPES.GoogleAuthCalendar)
      || types.has(GoogleAuthCalendar))
    && !skip.has(GoogleAuthCalendar)
    && !skip.has(TYPES.GoogleAuthCalendar)
  ) {
    container.bind<IGoogleAuth>(TYPES.GoogleAuthCalendar)
      .to(GoogleAuthCalendar);
    types.add(TYPES.Logger);
    types.add(TYPES.GoogleAuthCalendarKey);
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
      ))
      .onActivation(addDisposable);
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
    types.add(TYPES.GoogleGroupEmailPrefix);
  }

  if ((
    allRequired || types.has(TYPES.Container)
  ) && !skip.has(TYPES.Container)) {
    container.bind<IContainer>(TYPES.Container).toConstantValue(container);
  }

  if ((
    allRequired || types.has(TYPES.Config)
  ) && !skip.has(TYPES.Config)) {
    container.bind<ConfigService>(TYPES.Config).to(ConfigService);
  }

  if ((
    allRequired || types.has(TYPES.Logger)
  ) && !skip.has(TYPES.Logger)) {
    container.bind<ILogger>(TYPES.Logger).toConstantValue(logger);
  }

  // Constants

  if ((
    allRequired
    || types.has(TYPES.TaskProgressFileBackendFileName)
  ) && !skip.has(TYPES.TaskProgressFileBackendFileName)) {
    container.bind<string>(TYPES.TaskProgressFileBackendFileName)
      .toConstantValue(PathUtils.getPath(
        getConfig().tasks.progress.backendConfigs[TaskProgressBackend.File]
      ));
  }

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
    allRequired || types.has(TYPES.GoogleAuthCalendarKey)
  ) && !skip.has(TYPES.GoogleAuthCalendarKey)) {
    container.bind<GoogleAuthConfigKey>(TYPES.GoogleAuthCalendarKey)
      .toConstantValue(getConfig().google.auth.calendarKey);
  }

  if ((
    allRequired || types.has(TYPES.GoogleAuthSubject)
  ) && !skip.has(TYPES.GoogleAuthSubject)) {
    container.bind<string>(TYPES.GoogleAuthSubject).toConstantValue(
      getConfig().google.auth.adminSubjectEmail,
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
    allRequired || types.has(TYPES.GoogleGroupEmailPrefix)
  ) && !skip.has(TYPES.GoogleGroupEmailPrefix)) {
    container.bind<Nullable<string>>(
      TYPES.GoogleGroupEmailPrefix
    ).toConstantValue(getConfig().google.groupEmailPrefix);
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

  container.bind<CalendarService>(TYPES.CalendarService).to(CalendarService);
  container.bind<EventsService>(TYPES.EventsService).to(EventsService);


  if (boundTypes) {
    for (const type of types) {
      boundTypes.add(type);
    }
  } else {
    boundTypes = types;
  }
  if (initPromise) {
    initPromise = initPromise.then(() => getInitPromise(types));
  }
}

export function getContainerAsyncInitializer(
  additionalTypes?: Iterable<ServiceIdentifier<any>>
    | Iterator<ServiceIdentifier<any>>
) {
  if (!container) {
    throw new TypeError('Container is not initialized');
  }
  if (!initPromise) {
    initPromise = getInitPromise();
  }
  const types = new Set(additionalTypes as ServiceIdentifier<any>[]);
  return types.size === 0 ? initPromise : getInitPromise(types);
}

export function isContainerDisposing() {
  return !!disposing;
}

export async function disposeContainer() {
  if (!container || !disposeCallbacks) {
    throw new TypeError('Container is not initialized');
  }
  if (disposing) {
    return disposing;
  }

  disposing = Promise.resolve();
  for (const dispose of disposeCallbacks) {
    disposing.then(dispose);
  }
  await disposing;
  container.unload();
  container.unbindAll();
  boundTypes = null;
  initPromise = null;
  disposeCallbacks = null;
  container = null;
  disposing = null;
}

export function getContainer() {
  if (!container) {
    throw new TypeError('Container is not created');
  }
  return container;
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

function addDisposable<T extends IDisposable>(
  context: interfaces.Context,
  injectable: T,
) {
  if (disposeCallbacks) {
    disposeCallbacks.unshift(() => injectable.dispose());
  }
  return injectable;
}
