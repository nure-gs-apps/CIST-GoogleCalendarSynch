import axios, { AxiosInstance, AxiosResponse } from 'axios';
import * as iconv from 'iconv-lite';
import { inject, injectable } from 'inversify';
import { TYPES } from '../di/types';
import { dateToSeconds } from '../utils/common';

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

export enum TimetableType {
  GROUP = 1,
  TEACHER = 2,
  ROOM = 3,
}

export interface IDateLimits {
  from?: Date;
  to?: Date;
}

@injectable()
export class CistJsonClient {
  static readonly BASE_API_URL = 'http://cist.nure.ua/ias/app/tt/';
  static readonly ROOMS_PATH = 'P_API_AUDITORIES_JSON';
  static readonly GROUPS_PATH = 'P_API_GROUP_JSON';
  static readonly EVENTS_PATH = 'P_API_EVENT_JSON';

  private readonly _axios: AxiosInstance;
  private readonly _apiKey: string;

  constructor(
    @inject(TYPES.CistBaseApi) baseApiUrl: string,
    @inject(TYPES.CistApiKey) apiKey: string,
  ) {
    this._axios = axios.create({
      baseURL: baseApiUrl || CistJsonClient.BASE_API_URL,
      responseType: 'arraybuffer',
    });
    this._apiKey = apiKey;
    this._axios.interceptors.response.use(res => {
      const data = res.data as Buffer;
      res.data = (res.headers['content-type'] ?? '').toString().toLowerCase().includes('charset=windows-1251')
        ? iconv.decode(res.data, 'win1251')
        : data.toString('utf8');
      return res;
    });
  }

  getRoomsResponse() {
    return this._axios
      .get(CistJsonClient.ROOMS_PATH)
      .then(response => this.parseAuditoriesResponse(response));
  }

  getGroupsResponse() {
    return this._axios
      .get(CistJsonClient.GROUPS_PATH)
      .then(response => this.parseGroupsResponse(response));
  }

  getEventsResponse(
    type: TimetableType,
    entityId: number | string,
    dateLimits?: IDateLimits,
  ) {
    const queryParams: Record<string, any> = {
      api_key: this._apiKey,
      type_id: type,
      timetable_id: entityId,
    };
    if (dateLimits) {
      if (dateLimits.from) {
        queryParams.time_from = dateToSeconds(dateLimits.from);
      }
      if (dateLimits.to) {
        queryParams.time_to = dateToSeconds(dateLimits.to);
      }
    }
    return this._axios
      .get(CistJsonClient.EVENTS_PATH, {
        params: queryParams,
      })
      .then(response => this.parseEventsResponse(response));
  }

  private parseAuditoriesResponse(
    response: AxiosResponse,
  ): ApiAuditoriesResponse {
    const body = response.data;
    if (typeof body !== 'string') {
      throw new TypeError('Unexpected non-string response');
    }
    // Fixing body deficiencies
    const fixedBody = body.replace(/\[\s*}\s*]/g, '[]');
    return JSON.parse(fixedBody);
  }

  private parseGroupsResponse(
    response: AxiosResponse,
  ): ApiGroupsResponse {
    if (typeof response.data !== 'string') {
      throw new TypeError('Unexpected non-string response');
    }
    return JSON.parse(response.data);
  }

  private parseEventsResponse(
    response: AxiosResponse,
  ): ApiEventsResponse {
    if (typeof response.data !== 'string') {
      throw new TypeError('Unexpected non-string response');
    }
    return JSON.parse(response.data);
  }
}
