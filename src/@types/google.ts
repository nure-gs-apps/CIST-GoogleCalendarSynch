import { JWTInput } from 'google-auth-library';
import { CistDirection, CistFaculty, CistGroup, CistSpeciality } from './cist';
import { DeepReadonly } from './index';

export type GoogleAuthKey = JWTInput | string;

export interface ICistGroupData {
  readonly group: DeepReadonly<CistGroup>;
  readonly faculty: DeepReadonly<CistFaculty>;
  readonly direction: DeepReadonly<CistDirection>;
  readonly speciality?: DeepReadonly<CistSpeciality>;
}
