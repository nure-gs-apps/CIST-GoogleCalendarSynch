import { BindingScopeEnum, Container } from 'inversify';
import { Nullable } from '../@types';
import { CistJsonClient } from '../services/cist-json-client.service';
import { BuildingsService } from '../services/google/buildings.service';
import { GoogleApiAdmin } from '../services/google/google-api-admin';
import { GoogleAuth } from '../services/google/google-auth';
import { RoomsService } from '../services/google/rooms.service';
import { ASYNC_INIT, TYPES } from './types';

let container: Nullable<Container> = null;

export function hasContainer() {
  return !!container;
}

export function createContainer(forceNew = false) {
  if (!forceNew && container) {
    throw new TypeError('Container is already created');
  }
  container = new Container({
    autoBindInjectable: true,
    defaultScope: BindingScopeEnum.Singleton,
  });

  container.bind<CistJsonClient>(TYPES.CistJsonClient).to(CistJsonClient);
  container.bind<GoogleAuth>(TYPES.GoogleAuth).to(GoogleAuth);
  container.bind<GoogleApiAdmin>(TYPES.GoogleApiAdmin).to(GoogleApiAdmin);
  container.bind<BuildingsService>(TYPES.BuildingsService).to(BuildingsService);
  container.bind<RoomsService>(TYPES.RoomsService).to(RoomsService);

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

  promises.push(container.get<GoogleAuth>(TYPES.GoogleAuth)[ASYNC_INIT]);

  initPromise = Promise.all(promises!);
  return initPromise;
}
