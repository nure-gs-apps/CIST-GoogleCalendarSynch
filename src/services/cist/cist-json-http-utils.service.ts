import { AxiosResponse } from 'axios';
import { injectable } from 'inversify';
import {
  ApiAuditoriesResponse,
  ApiEventsResponse,
  ApiGroupsResponse,
} from './types';

@injectable()
export class CistJsonHttpUtilsService {
  parseAuditoriesResponse(
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
    return JSON.parse(response.data);
  }
}
