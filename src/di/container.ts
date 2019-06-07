import * as config from 'config';
import { BindingScopeEnum, Container } from 'inversify';
import { Nullable } from '../@types';
import { CistJsonClient } from '../services/cist-json-client.service';
import { BuildingsService } from '../services/google/buildings.service';
import { GoogleApiAdmin } from '../services/google/google-api-admin';
import { GoogleAdminAuth } from '../services/google/google-admin-auth';
import { IGoogleAuth } from '../services/google/interfaces';
import { RoomsService } from '../services/google/rooms.service';
import { ASYNC_INIT, ContainerType, TYPES } from './types';

let container: Nullable<Container> = null;
let containerType: Nullable<ContainerType> = null;

export function hasContainer() {
  return !!container;
}

export interface ICreateContainerOptions {
  type: ContainerType;
  forceNew: boolean;
}

export interface IConfig {
  cist: {
    baseUrl: string;
    apiKey: string;
  };
  google: {
    idPrefix: string;
    auth: {
      subjectEmail: string;
      calendarKeyFilepath: string;
      adminKeyFilepath: string;
    };
  };
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
  container = new Container({
    autoBindInjectable: true,
    defaultScope: BindingScopeEnum.Singleton,
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
      ),
    );
    container.bind<string>(TYPES.GoogleAuthAdminKeyFilepath).toConstantValue(
      config.get<IConfig['google']['auth']['adminKeyFilepath']>(
        'google.auth.adminKeyFilepath',
      ),
    );

    container.bind<CistJsonClient>(TYPES.CistJsonClient).to(CistJsonClient);
    container.bind<IGoogleAuth>(TYPES.GoogleAdminAuth).to(GoogleAdminAuth);
    container.bind<GoogleApiAdmin>(TYPES.GoogleApiAdmin).to(GoogleApiAdmin);
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
    promises.push(container.get<GoogleAdminAuth>(TYPES.GoogleAdminAuth)[ASYNC_INIT]);
  }

  initPromise = Promise.all(promises!);
  return initPromise;
}
