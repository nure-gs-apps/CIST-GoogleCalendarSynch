"use strict";
var CistJsonClient_1;
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
"use strict";
const axios_1 = require("axios");
const Iconv = require("iconv");
const inversify_1 = require("inversify");
const ts_optchain_1 = require("ts-optchain");
const types_1 = require("../di/types");
const common_1 = require("../utils/common");
var TimetableType;
(function (TimetableType) {
    TimetableType[TimetableType["GROUP"] = 1] = "GROUP";
    TimetableType[TimetableType["TEACHER"] = 2] = "TEACHER";
    TimetableType[TimetableType["ROOM"] = 3] = "ROOM";
})(TimetableType = exports.TimetableType || (exports.TimetableType = {}));
let CistJsonClient = CistJsonClient_1 = class CistJsonClient {
    constructor(baseApiUrl, apiKey) {
        this._axios = axios_1.default.create({
            baseURL: baseApiUrl || CistJsonClient_1.BASE_API_URL,
            responseType: 'arraybuffer',
        });
        this._apiKey = apiKey;
        this._iconv = new Iconv.Iconv('windows-1251', 'utf8');
        this._axios.interceptors.response.use(res => {
            const data = res.data;
            res.data = res.headers['content-type'].toString().toLowerCase().includes('charset=windows-1251')
                ? this._iconv.convert(data).toString('utf8')
                : data.toString('utf8');
            return res;
        });
    }
    getRoomsResponse() {
        return this._axios
            .get(CistJsonClient_1.ROOMS_PATH)
            .then(response => this.parseAuditoriesResponse(response));
    }
    getGroupsResponse() {
        return this._axios
            .get(CistJsonClient_1.GROUPS_PATH)
            .then(response => this.parseGroupsResponse(response));
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
            .get(CistJsonClient_1.EVENTS_PATH, {
            params: queryParams,
        })
            .then(response => this.parseEventsResponse(response));
    }
    parseAuditoriesResponse(response) {
        const body = response.data;
        if (typeof body !== 'string') {
            throw new TypeError('Unexpected non-string response');
        }
        // Fixing body deficiencies
        const fixedBody = body.replace(/\[\s*}\s*]/g, '[]');
        return JSON.parse(fixedBody);
    }
    parseGroupsResponse(response) {
        if (typeof response.data !== 'string') {
            throw new TypeError('Unexpected non-string response');
        }
        return JSON.parse(response.data);
    }
    parseEventsResponse(response) {
        if (typeof response.data !== 'string') {
            throw new TypeError('Unexpected non-string response');
        }
        return JSON.parse(response.data);
    }
};
CistJsonClient.BASE_API_URL = 'http://cist.nure.ua/ias/app/tt/';
CistJsonClient.ROOMS_PATH = 'P_API_AUDITORIES_JSON';
CistJsonClient.GROUPS_PATH = 'P_API_GROUP_JSON';
CistJsonClient.EVENTS_PATH = 'P_API_EVENT_JSON';
CistJsonClient = CistJsonClient_1 = tslib_1.__decorate([
    inversify_1.injectable(),
    tslib_1.__param(0, inversify_1.inject(types_1.TYPES.CistBaseApi)),
    tslib_1.__param(1, inversify_1.inject(types_1.TYPES.CistApiKey)),
    tslib_1.__metadata("design:paramtypes", [String, String])
], CistJsonClient);
exports.CistJsonClient = CistJsonClient;
//# sourceMappingURL=cist-json-client.service.js.map