import axios, { AxiosInstance, AxiosResponse } from 'axios';
import * as Iconv from 'iconv';
import { injectable } from 'inversify';
import { oc } from 'ts-optchain';

export interface ApiAuditoriesResponse {
  university: {
    short_name: string;
    full_name: string;
    buildings: ApiBuilding[];
  };
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

@injectable()
export class CistJsonClient {
  static readonly BASE_API_URL = 'http://cist.nure.ua/ias/app/tt/';
  static readonly ROOM_PATH = 'P_API_AUDITORIES_JSON';

  private _axios: AxiosInstance;
  private _iconv: Iconv.Iconv;

  constructor(baseApiUrl = CistJsonClient.BASE_API_URL) {
    this._axios = axios.create({
      baseURL: baseApiUrl,
      responseType: 'arraybuffer',
    });
    // @ts-ignore
    this._iconv = new Iconv.Iconv('windows-1251', 'utf8');
    this._axios.interceptors.response.use(res => {
      const data = res.data as Buffer;
      res.data = oc(res.headers['content-type']).toString().toLowerCase().includes('charset=windows-1251')
        ? this._iconv.convert(data).toString('utf8')
        : data.toString('utf8');
      return res;
    });
  }

  getRoomResponse() {
    return this._axios
      .get(CistJsonClient.ROOM_PATH)
      .then(response => this.parseAuditoriesResponse(response));
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
}
