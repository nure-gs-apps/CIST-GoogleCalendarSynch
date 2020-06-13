import { calendar_v3 } from 'googleapis';
import { JWTInput } from 'google-auth-library';
import { IEventsTaskContextBase } from '../services/google/events.service';
import { CistDirection, CistFaculty, CistGroup, CistSpeciality } from './cist';
import { DeepReadonly } from './index';
import { ICrossPlatformFilePath } from './utils';
import Schema$Event = calendar_v3.Schema$Event;

export type GoogleAuthKey = JWTInput | string;

export interface ICistGroupData {
  readonly group: DeepReadonly<CistGroup>;
  readonly faculty: DeepReadonly<CistFaculty>;
  readonly direction: DeepReadonly<CistDirection>;
  readonly speciality?: DeepReadonly<CistSpeciality>;
}

export enum GoogleEventsTaskContextStorage {
  File = 'file'
}

export const googleEventsTaskContextStorageValues = Object.values(
  GoogleEventsTaskContextStorage
) as ReadonlyArray<GoogleEventsTaskContextStorage>;

// tslint:disable-next-line:max-line-length
export const defaultGoogleEventsTaskContextStorage = GoogleEventsTaskContextStorage.File;

export interface IGoogleEventsTaskContextStorageConfig {
  backend: GoogleEventsTaskContextStorage;
  backendConfigs: {
    [GoogleEventsTaskContextStorage.File]: ICrossPlatformFilePath;
  };
}

export interface IEventsTaskContextStorage {
  exists(): Promise<boolean>;
  load(): Promise<IEventsTaskContextBase>;
  save(context: DeepReadonly<IEventsTaskContextBase>): Promise<void>;
  clear(): Promise<void>;
}

export interface ISerializableEventsTaskContext {
  nextPageToken?: string;
  events: [string, Schema$Event][];
  relevantEventIds?: string[];
  insertEvents?: [string, Schema$Event][];
  patchEvents?: [string, Schema$Event][];
}
