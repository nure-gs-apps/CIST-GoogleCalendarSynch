import { inject, injectable } from 'inversify';
import { iterate } from 'iterare';
import { GuardedMap, t } from '../../@types';
import { TYPES } from '../../di/types';
import {
  getGoogleRoomShortName,
  GoogleUtilsService,
  IGoogleEventContext,
} from './google-utils.service';
import { GroupsService } from './groups.service';
import { RoomsService } from './rooms.service';

export type EventGoogleContext = Pick<IGoogleEventContext, 'googleGroups' | 'roomEmailsByNames'>;

@injectable()
export class EventContextService {
  private readonly _groupsService: GroupsService;
  private readonly _roomsService: RoomsService;
  private readonly _utils: GoogleUtilsService;

  constructor(
    @inject(TYPES.RoomsService) roomsService: RoomsService,
    @inject(TYPES.GroupsService) groupsService: GroupsService,
    @inject(TYPES.GoogleUtils) utils: GoogleUtilsService,
  ) {
    this._roomsService = roomsService;
    this._groupsService = groupsService;
    this._utils = utils;
  }

  async createGeneralContext() {
    const groups = new GuardedMap(
      iterate(await this._groupsService.getAllGroups())
        .filter(g => typeof g.email === 'string')
        .map(g => t(this._utils.getGroupIdFromEmail(g.email as string), g))
    );
    const rooms = new GuardedMap(
      iterate(await this._roomsService.getAllRooms())
        .filter(r => typeof r.resourceName === 'string'
          && typeof r.resourceEmail === 'string')
        .map(r => t(
          getGoogleRoomShortName(r) as string,
          r.resourceEmail as string,
        ))
    );
    const context: EventGoogleContext = {
      roomEmailsByNames: rooms,
      googleGroups: groups
    };
    return context;
  }
}
