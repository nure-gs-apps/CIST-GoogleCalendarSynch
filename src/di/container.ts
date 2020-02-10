import Bottleneck from 'bottleneck';
import { getConfig } from '../config';
import { BindingScopeEnum, Container } from 'inversify';
import { ICalendarConfig, Nullable } from '../@types';
import { CistJsonClient } from '../services/cist-json-client.service';
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
import {
  getQuotaLimiterFactory,
  QuotaLimiterService,
} from '../services/quota-limiter.service';
import { ASYNC_INIT, ContainerType, TYPES } from './types';

let container: Nullable<Container> = null;
let containerType: Nullable<ContainerType> = null;

export interface ICreateContainerOptions {
  type: ContainerType;
  forceNew: boolean;
}

export function hasContainer() {
  return !!container;
}

export function createContainer(options?: Partial<ICreateContainerOptions>) {
  const { forceNew, type } = Object.assign({
    forceNew: false,
    type: ContainerType.FULL,
  }, options);
  containerType = type;

  if (!forceNew && container) {
    throw new TypeError('Container is already created');
  }
  const defaultScope = BindingScopeEnum.Singleton;
  container = new Container({
    defaultScope,
    autoBindInjectable: true,
  });

  if (containerType === ContainerType.FULL) {
    container.bind<string>(TYPES.CistBaseApi).toConstantValue(
      getConfig().cist.baseUrl,
    );
    container.bind<string>(TYPES.CistApiKey).toConstantValue(
      getConfig().cist.apiKey,
    );
    container.bind<string>(TYPES.GoogleAuthSubject).toConstantValue(
      getConfig().google.auth.subjectEmail,
    );

    container.bind<string>(TYPES.GoogleAuthKeyFilepath)
      .toConstantValue(
        getConfig().google.auth.keyFilepath // TODO: clarify configuration
          || process.env.GOOGLE_APPLICATION_CREDENTIALS!,
      );
    container.bind<ReadonlyArray<string>>(TYPES.GoogleAuthScopes)
      .toConstantValue(directoryAuthScopes.concat(calenderAuthScopes));
    container.bind<ICalendarConfig>(TYPES.GoogleCalendarConfig).toConstantValue(
      getConfig().google.calendar,
    );

    container.bind<CistJsonClient>(TYPES.CistJsonClient).to(CistJsonClient);

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
  } else if (containerType === ContainerType.CIST_JSON_ONLY) {
    container.bind<string>(TYPES.CistBaseApi).toConstantValue(
      getConfig().cist.baseUrl,
    );
    container.bind<string>(TYPES.CistApiKey).toConstantValue(
      getConfig().cist.apiKey,
    );

    container.bind<CistJsonClient>(TYPES.CistJsonClient).to(CistJsonClient);
  }
  return container;
}

export function getContainer() {
  if (!container) {
    throw new TypeError('Container is not created');
  }
  return container;
}

let initPromise: Nullable<Promise<any[]>> = null;
export function getAsyncInitializers() {
  if (!container) {
    throw new TypeError('Container is not initialized');
  }
  if (initPromise) {
    return initPromise;
  }
  const promises = [] as Promise<any>[];

  if (containerType === ContainerType.FULL) {
    promises.push(
      container.get<GoogleAuth>(TYPES.GoogleAuth)[ASYNC_INIT],
    );
  }

  initPromise = Promise.all(promises!);
  return initPromise;
}
