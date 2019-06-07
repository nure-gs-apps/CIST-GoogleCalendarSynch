import Bottleneck from 'bottleneck';
import * as config from 'config';
import { BindingScopeEnum, Container } from 'inversify';
import { IConfig, Nullable } from '../@types';
import { CistJsonClient } from '../services/cist-json-client.service';
import { BuildingsService } from '../services/google/buildings.service';
import { GoogleDirectoryAuth } from '../services/google/google-directory-auth';
import { GoogleApiDirectory } from '../services/google/google-api-directory';
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
      config.get<IConfig['cist']['baseUrl']>('cist.baseUrl'),
    );
    container.bind<string>(TYPES.CistApiKey).toConstantValue(
      config.get<IConfig['cist']['apiKey']>('cist.apiKey'),
    );
    container.bind<string>(TYPES.GoogleAuthSubject).toConstantValue(
      config.get<IConfig['google']['auth']['subjectEmail']>(
        'google.auth.subjectEmail',
      ),
    );
    container.bind<string>(TYPES.GoogleAuthCalendarKeyFilepath).toConstantValue(
      config.get<IConfig['google']['auth']['calendarKeyFilepath']>(
        'google.auth.calendarKeyFilepath',
      ) || process.env.GOOGLE_APPLICATION_CREDENTIALS!,
    );
    container.bind<string>(TYPES.GoogleAuthAdminKeyFilepath).toConstantValue(
      config.get<IConfig['google']['auth']['adminKeyFilepath']>(
        'google.auth.adminKeyFilepath',
      ) || process.env.GOOGLE_APPLICATION_CREDENTIALS!,
    );

    container.bind<CistJsonClient>(TYPES.CistJsonClient).to(CistJsonClient);
    container.bind<IGoogleAuth>(TYPES.GoogleAdminAuth).to(GoogleDirectoryAuth);
    container.bind<QuotaLimiterService>(TYPES.GoogleDirectoryQuotaLimiter)
      .toDynamicValue(getQuotaLimiterFactory(
        config.get<IConfig['google']['quotas']['directoryApi']>('google.quotas.directoryApi'),
        defaultScope === BindingScopeEnum.Singleton,
      ));
    container.bind<GoogleApiDirectory>(TYPES.GoogleApiAdmin).to(GoogleApiDirectory);
    container.bind<BuildingsService>(TYPES.BuildingsService)
      .to(BuildingsService);
    container.bind<RoomsService>(TYPES.RoomsService).to(RoomsService);
  } else if (containerType === ContainerType.CIST_JSON_ONLY) {
    container.bind<string>(TYPES.CistBaseApi).toConstantValue(
      config.get<IConfig['cist']['baseUrl']>('cist.baseUrl'),
    );
    container.bind<string>(TYPES.CistApiKey).toConstantValue(
      config.get<IConfig['cist']['apiKey']>('cist.apiKey'),
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
      container.get<GoogleDirectoryAuth>(TYPES.GoogleAdminAuth)[ASYNC_INIT],
    );
  }

  initPromise = Promise.all(promises!);
  return initPromise;
}
