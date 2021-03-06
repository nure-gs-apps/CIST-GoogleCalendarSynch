import axios, { AxiosInstance } from 'axios';
import * as iconv from 'iconv-lite';
import { inject, injectable } from 'inversify';
import { DeepReadonly } from '../../@types';
import { TYPES } from '../../di/types';
import { NestedError } from '../../errors';
import { dateToSeconds } from '../../utils/common';
import {
  ICistJsonClient,
  ICistJsonHttpParserService,
  IDateLimits,
  TimetableType,
} from '../../@types/cist';

interface IQueryParams {
  idClient: string;
  type_id: TimetableType;
  timetable_id: string | number;
  time_from?: number;
  time_to?: number;
}

// function cloneQueryParams(params: IQueryParams) {
//   const newParams = {
//     type_id: params.type_id,
//     timetable_id: params.timetable_id,
//     idClient: params.idClient,
//   } as IQueryParams;
//   if (params.time_from) {
//     newParams.time_from = params.time_from;
//   }
//   if (params.time_to) {
//     newParams.time_to = params.time_to;
//   }
//   return newParams;
// }

@injectable()
export class CistJsonHttpClient implements ICistJsonClient {
  static readonly BASE_API_URL = 'http://cist.nure.ua/ias/app/tt/';
  static readonly ROOMS_PATH = 'P_API_AUDITORIES_JSON';
  static readonly GROUPS_PATH = 'P_API_GROUP_JSON';
  static readonly EVENTS_PATH = 'P_API_EVENT_JSON';

  protected readonly _axios: AxiosInstance;
  protected readonly _apiKey: string;
  protected readonly _cistParser: ICistJsonHttpParserService;

  constructor(
    @inject(TYPES.CistBaseApiUrl) baseApiUrl: string,
    @inject(TYPES.CistApiKey) apiKey: string,
    @inject(TYPES.CistJsonHttpParser) cistParser: ICistJsonHttpParserService,
  ) {
    this._axios = axios.create({
      baseURL: baseApiUrl || CistJsonHttpClient.BASE_API_URL,
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
    this._cistParser = cistParser;
  }

  getRoomsResponse() {
    return this._axios
      .get(CistJsonHttpClient.ROOMS_PATH)
      .then(response => this._cistParser.parseRoomsResponse(response));
  }

  getGroupsResponse() {
    return this._axios
      .get(CistJsonHttpClient.GROUPS_PATH)
      .then(response => this._cistParser.parseGroupsResponse(response))
      .catch(error => { throw new NestedError('CIST Groups request error', error); });
  }

  getEventsResponse(
    type: TimetableType,
    entityId: number | string,
    dateLimits?: DeepReadonly<IDateLimits>,
  ) {
    const queryParams: IQueryParams = {
      idClient: this._apiKey,
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
      .get(CistJsonHttpClient.EVENTS_PATH, {
        params: queryParams,
      })
      .then(response => this._cistParser.parseEventsResponse(response))
      .catch(error => {
        let message = `CIST Events request error. type: ${TimetableType[type]}, id: ${entityId}`;
        if (dateLimits) {
          if (dateLimits.from) {
            message += `, timeFrom: ${dateLimits.from.toISOString()}`;
          }
          if (dateLimits.to) {
            message += `, timeTo: ${dateLimits.to.toISOString()}`;
          }
        }
        throw new NestedError(message, error);
      });
  }
}
