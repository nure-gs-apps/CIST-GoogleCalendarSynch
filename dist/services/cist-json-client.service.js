"use strict";
var CistJsonClient_1;
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
"use strict";
const axios_1 = require("axios");
const Iconv = require("iconv");
const inversify_1 = require("inversify");
const ts_optchain_1 = require("ts-optchain");
let CistJsonClient = CistJsonClient_1 = class CistJsonClient {
    constructor(baseApiUrl = CistJsonClient_1.BASE_API_URL) {
        this._axios = axios_1.default.create({
            baseURL: baseApiUrl,
            responseType: 'arraybuffer',
        });
        // @ts-ignore
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
    getGroupResponse() {
        return this._axios
            .get(CistJsonClient_1.GROUPS_PATH)
            .then(response => this.parseGroupResponse(response));
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
    parseGroupResponse(response) {
        if (typeof response.data !== 'string') {
            throw new TypeError('Unexpected non-string response');
        }
        return JSON.parse(response.data);
    }
};
CistJsonClient.BASE_API_URL = 'http://cist.nure.ua/ias/app/tt/';
CistJsonClient.ROOMS_PATH = 'P_API_AUDITORIES_JSON';
CistJsonClient.GROUPS_PATH = 'P_API_GROUP_JSON';
CistJsonClient = CistJsonClient_1 = tslib_1.__decorate([
    inversify_1.injectable(),
    tslib_1.__metadata("design:paramtypes", [Object])
], CistJsonClient);
exports.CistJsonClient = CistJsonClient;
//# sourceMappingURL=cist-json-client.service.js.map