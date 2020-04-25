import { DeepReadonly, Nullable } from '../../@types';

export interface ICistJsonClient {
  getRoomsResponse(): Promise<ApiAuditoriesResponse>;
  getGroupsResponse(): Promise<ApiGroupsResponse>;
  getEventsResponse(
    type: TimetableType,
    entityId: number | string,
    dateLimits?: DeepReadonly<IDateLimits>,
  ): Promise<ApiEventsResponse>;
}

export class ThrowCistJsonClient implements ICistJsonClient {
  private static _getInstance: Nullable<ThrowCistJsonClient> = null;
  public static getInstance() {
    if (!this._getInstance) {
      this._getInstance = new ThrowCistJsonClient();
    }
    return this._getInstance;
  }

  private constructor() {
  }

  getEventsResponse(
    type: TimetableType,
    entityId: number | string,
    dateLimits?: DeepReadonly<IDateLimits>
  ): Promise<ApiEventsResponse> {
    throw new TypeError('Cist Json Client is not found');
  }

  getGroupsResponse(): Promise<ApiGroupsResponse> {
    throw new TypeError('Cist Json Client is not found');
  }

  getRoomsResponse(): Promise<ApiAuditoriesResponse> {
    throw new TypeError('Cist Json Client is not found');
  }

}

export interface ApiAuditoriesResponse {
  university: {
    short_name: string;
    full_name: string;
    buildings: ApiBuilding[];
  };
}

export interface ApiGroupsResponse {
  university: {
    short_name: string;
    full_name: string;
    faculties: ApiFaculty[];
  };
}

export interface ApiEventsResponse {
  'time-zone': string;
  events: ApiEvent[];
  groups: ApiGroup[];
  teachers: ApiTeacher[];
  subjects: ApiSubject[];
  types: ApiEventType[];
}

export interface ApiBuilding {
  id: string; // the same as short_name, but don't rely
  short_name: string;
  full_name: string;
  auditories: ApiAuditory[];
}

export interface ApiAuditory {
  id: string;
  short_name: string;
  floor: string; // number in fact
  is_have_power: string; // string one or (presumably) zero
  auditory_types: ApiAuditoryType[];
}

export interface ApiAuditoryType {
  id: string;
  short_name: string; // (presumably) direction (branch)
}

export interface ApiFaculty {
  id: number;
  short_name: string;
  full_name: string;
  directions: ApiDirection[];
}

export interface ApiDirection {
  id: number;
  short_name: string;
  full_name: string;
  groups?: ApiGroup[];
  specialities: ApiSpeciality[];
}

export interface ApiSpeciality {
  id: number;
  short_name: string;
  full_name: string;
  groups: ApiGroup[];
}

export interface ApiGroup {
  id: number;
  name: string;
}

export interface ApiEvent {
  subject_id: number;
  start_time: number;
  end_time: number;
  type: number;
  number_pair: number;
  auditory: string;
  teachers: number[];
  groups: number[];
}

export interface ApiTeacher {
  id: string;
  short_name: string;
  full_name: string;
}

export interface ApiSubject {
  id: number;
  brief: string;
  title: string;
  hours: ApiSubjectHour[];
}

export interface ApiSubjectHour {
  type: number;
  val: number;
  teachers: number[];
}

export interface ApiEventType { // for course work: #BFC9CA
  id: number;
  short_name: string;
  full_name: string;
  id_base: number;
  type: string;
}

export interface IEventsQueryParams {
  typeId: TimetableType;
  dateLimits?: IDateLimits;
  entityId: number | string;
}

export enum TimetableType {
  GROUP = 1,
  TEACHER = 2,
  ROOM = 3,
}

export interface IDateLimits {
  from?: Date;
  to?: Date;
}