"use strict";
var CistJsonHttpClient_1;
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const axios_1 = require("axios");
const iconv = require("iconv-lite");
const inversify_1 = require("inversify");
const types_1 = require("../../di/types");
const common_1 = require("../../utils/common");
// function cloneQueryParams(params: IQueryParams) {
//   const newParams = {
//     type_id: params.type_id,
//     timetable_id: params.timetable_id,
//     api_key: params.api_key,
//   } as IQueryParams;
//   if (params.time_from) {
//     newParams.time_from = params.time_from;
//   }
//   if (params.time_to) {
//     newParams.time_to = params.time_to;
//   }
//   return newParams;
// }
let CistJsonHttpClient = CistJsonHttpClient_1 = class CistJsonHttpClient {
    constructor(baseApiUrl, apiKey, cistParser) {
        Object.defineProperty(this, "_axios", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "_apiKey", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "_cistParser", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this._axios = axios_1.default.create({
            baseURL: baseApiUrl || CistJsonHttpClient_1.BASE_API_URL,
            responseType: 'arraybuffer',
        });
        this._apiKey = apiKey;
        this._axios.interceptors.response.use(res => {
            var _a;
            const data = res.data;
            res.data = ((_a = res.headers['content-type']) !== null && _a !== void 0 ? _a : '').toString().toLowerCase().includes('charset=windows-1251')
                ? iconv.decode(res.data, 'win1251')
                : data.toString('utf8');
            return res;
        });
        this._cistParser = cistParser;
    }
    getRoomsResponse() {
        return this._axios
            .get(CistJsonHttpClient_1.ROOMS_PATH)
            .then(response => this._cistParser.parseAuditoriesResponse(response));
    }
    getGroupsResponse() {
        return this._axios
            .get(CistJsonHttpClient_1.GROUPS_PATH)
            .then(response => this._cistParser.parseGroupsResponse(response));
    }
    getEventsResponse(type, entityId, dateLimits) {
        const queryParams = {
            api_key: this._apiKey,
            type_id: type,
            timetable_id: entityId,
        };
        if (dateLimits) {
            if (dateLimits.from) {
                queryParams.time_from = common_1.dateToSeconds(dateLimits.from);
            }
            if (dateLimits.to) {
                queryParams.time_to = common_1.dateToSeconds(dateLimits.to);
            }
        }
        return this._axios
            .get(CistJsonHttpClient_1.EVENTS_PATH, {
            params: queryParams,
        })
            .then(response => this._cistParser.parseEventsResponse(response));
    }
};
Object.defineProperty(CistJsonHttpClient, "BASE_API_URL", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: 'http://cist.nure.ua/ias/app/tt/'
});
Object.defineProperty(CistJsonHttpClient, "ROOMS_PATH", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: 'P_API_AUDITORIES_JSON'
});
Object.defineProperty(CistJsonHttpClient, "GROUPS_PATH", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: 'P_API_GROUP_JSON'
});
Object.defineProperty(CistJsonHttpClient, "EVENTS_PATH", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: 'P_API_EVENT_JSON'
});
CistJsonHttpClient = CistJsonHttpClient_1 = tslib_1.__decorate([
    inversify_1.injectable(),
    tslib_1.__param(0, inversify_1.inject(types_1.TYPES.CistBaseApiUrl)),
    tslib_1.__param(1, inversify_1.inject(types_1.TYPES.CistApiKey)),
    tslib_1.__param(2, inversify_1.inject(types_1.TYPES.CistJsonHttpParser)),
    tslib_1.__metadata("design:paramtypes", [String, String, Object])
], CistJsonHttpClient);
exports.CistJsonHttpClient = CistJsonHttpClient;
//# sourceMappingURL=cist-json-http-client.service.js.map