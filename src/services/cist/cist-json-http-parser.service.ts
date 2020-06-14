import { AxiosResponse } from 'axios';
import { injectable } from 'inversify';
import {
  CistRoomsResponse,
  CistEventsResponse,
  CistGroupsResponse,
  ICistJsonHttpParserService,
} from '../../@types/cist';

@injectable()
export class CistJsonHttpParserService implements ICistJsonHttpParserService {
  parseRoomsResponse(
    response: AxiosResponse,
  ): CistRoomsResponse {
    const body = response.data;
    if (typeof body !== 'string') {
      throw new TypeError('Unexpected non-string response');
    }
    // Fixing body deficiencies
    const fixedBody = body.replace(/\[\s*}\s*]/g, '[]');
    return JSON.parse(fixedBody);
  }

  parseGroupsResponse(
    response: AxiosResponse,
  ): CistGroupsResponse {
    if (typeof response.data !== 'string') {
      throw new TypeError('Unexpected non-string response');
    }
    return JSON.parse(response.data);
  }

  parseEventsResponse(
    response: AxiosResponse,
  ): CistEventsResponse {
    if (typeof response.data !== 'string') {
      throw new TypeError('Unexpected non-string response');
    }
    // Fixing body deficiencies
    const fixedBody = response.data
      .replace(/"events"\s*:\s*\[\s*]\s*}\s*]/g, '"events":[]')
      .replace(/"type":\s*,/g, '"type":0,');
    return JSON.parse(fixedBody);
  }
}
