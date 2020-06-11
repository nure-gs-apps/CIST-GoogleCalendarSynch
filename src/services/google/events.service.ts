import { calendar_v3 } from 'googleapis';
import { inject, injectable } from 'inversify';
import { ILogger } from '../../@types/logging';
import { TYPES } from '../../di/types';
import { QuotaLimiterService } from '../quota-limiter.service';
import { GoogleApiCalendar } from './google-api-calendar';
import { GoogleUtilsService } from './google-utils.service';
import Resource$Events = calendar_v3.Resource$Events;

@injectable()
export class EventsService {
  static readonly ROOMS_PAGE_SIZE = 2500; // max limit
  private readonly _calendar: GoogleApiCalendar;
  private readonly _quotaLimiter: QuotaLimiterService;
  private readonly _utils: GoogleUtilsService;
  private readonly _logger: ILogger;

  private readonly _events: Resource$Events;

  private readonly _insert: Resource$Events['insert'];
  private readonly _patch: Resource$Events['patch'];
  private readonly _delete: Resource$Events['delete'];
  private readonly _list: Resource$Events['list'];

  constructor(
    @inject(TYPES.GoogleApiCalendar) googleApiCalendar: GoogleApiCalendar,
    @inject(TYPES.GoogleCalendarQuotaLimiter) quotaLimiter: QuotaLimiterService,
    @inject(TYPES.GoogleUtils) utils: GoogleUtilsService,
    @inject(TYPES.Logger) logger: ILogger,
  ) {
    this._utils = utils;
    this._logger = logger;

    this._calendar = googleApiCalendar;
    this._events = this._calendar.googleCalendar.events;
    this._quotaLimiter = quotaLimiter;

    this._insert = this._quotaLimiter.limiter.wrap(
      this._events.insert.bind(this._events),
    ) as any;
    this._patch = this._quotaLimiter.limiter.wrap(
      this._events.patch.bind(this._events),
    ) as any;
    this._delete = this._quotaLimiter.limiter.wrap(
      this._events.delete.bind(this._events),
    ) as any;
    this._list = this._quotaLimiter.limiter.wrap(
      this._events.list.bind(this._events),
    ) as any;
  }
}
