import { AxiosResponse } from 'axios';
import { injectable } from 'inversify';
import {
  ApiRoomsResponse,
  ApiEventsResponse,
  ApiGroupsResponse,
  ICistJsonHttpParserService,
} from './types';

@injectable()
export class CistJsonHttpParserService implements ICistJsonHttpParserService {
  parseRoomsResponse(
    response: AxiosResponse,
  ): ApiRoomsResponse {
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
  ): ApiGroupsResponse {
    if (typeof response.data !== 'string') {
      throw new TypeError('Unexpected non-string response');
    }
    return JSON.parse(response.data);
  }

  parseEventsResponse(
    response: AxiosResponse,
  ): ApiEventsResponse {
    if (typeof response.data !== 'string') {
      throw new TypeError('Unexpected non-string response');
    }
    // Fixing body deficiencies
    const fixedBody = response.data.replace(/"events"\s*:\s*\[\s*]\s*}\s*]/g, '"events":[]');
    return JSON.parse(fixedBody);
  }
}
