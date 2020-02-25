import axios, { AxiosInstance } from 'axios';
import * as iconv from 'iconv-lite';
import { inject, injectable } from 'inversify';
import { TYPES } from '../../di/types';

@injectable()
export class CistJsonHttpClient {
  static readonly BASE_API_URL = 'http://cist.nure.ua/ias/app/tt/';
  static readonly ROOMS_PATH = 'P_API_AUDITORIES_JSON';
  static readonly GROUPS_PATH = 'P_API_GROUP_JSON';
  static readonly EVENTS_PATH = 'P_API_EVENT_JSON';

  readonly axios: AxiosInstance;
  readonly apiKey: string;

  constructor(
    @inject(TYPES.CistBaseApi) baseApiUrl: string,
    @inject(TYPES.CistApiKey) apiKey: string,
  ) {
    this.axios = axios.create({
      baseURL: baseApiUrl || CistJsonHttpClient.BASE_API_URL,
      responseType: 'arraybuffer',
    });
    this.apiKey = apiKey;
    this.axios.interceptors.response.use(res => {
      const data = res.data as Buffer;
      res.data = (res.headers['content-type'] ?? '').toString().toLowerCase().includes('charset=windows-1251')
        ? iconv.decode(res.data, 'win1251')
        : data.toString('utf8');
      return res;
    });
    this.axios.interceptors.request.use(requestConfig => {
      if (requestConfig.url === CistJsonHttpClient.EVENTS_PATH) {
        // TODO: define correct parameter name
        requestConfig.params.api_key = this.apiKey;
      }
      return requestConfig;
    });
  }
}
