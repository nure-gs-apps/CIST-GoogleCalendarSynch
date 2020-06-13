import { interfaces } from 'inversify';
import {
  defaultGoogleEventsTaskContextStorage,
  GoogleEventsTaskContextStorage, googleEventsTaskContextStorageValues,
  IEventsTaskContextStorage,
} from '../../../@types/google';
import { TYPES } from '../../../di/types';
import { FileEventsTaskContextStorage } from './file';

export function getEventsTaskContextStorage(
  context: interfaces.Context
): IEventsTaskContextStorage {
  let type = context.container.get<GoogleEventsTaskContextStorage>(
    TYPES.GoogleCalendarEventsTaskContextStorageType
  );
  if (!googleEventsTaskContextStorageValues.includes(type)) {
    type = defaultGoogleEventsTaskContextStorage;
  }
  switch (type) {
    case GoogleEventsTaskContextStorage.File:
      return context.container.get<FileEventsTaskContextStorage>(
        TYPES.GoogleCalendarEventsFileTaskContextStorage
      );
  }
}

export function getEventsTaskContextStorageSymbol(
  eventsTaskContextStorage: GoogleEventsTaskContextStorage | string
) {
  let type = eventsTaskContextStorage as GoogleEventsTaskContextStorage;
  if (!googleEventsTaskContextStorageValues.includes(type)) {
    type = defaultGoogleEventsTaskContextStorage;
  }
  switch (type) {
    case GoogleEventsTaskContextStorage.File:
      return TYPES.GoogleCalendarEventsFileTaskContextStorage;
  }
}
