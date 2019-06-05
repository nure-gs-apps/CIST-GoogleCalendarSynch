"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const axios_1 = require("axios");
const Iconv = require("iconv");
const ts_optchain_1 = require("ts-optchain");
class CistClient {
    constructor(baseApiUrl = CistClient.BASE_API_URL) {
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
    getRoomResponse() {
        return this._axios
            .get(CistClient.ROOM_PATH)
            .then(response => this.parseAuditoriesResponse(response));
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
}
CistClient.BASE_API_URL = 'http://cist.nure.ua/ias/app/tt/';
CistClient.ROOM_PATH = 'P_API_AUDITORIES_JSON';
exports.CistClient = CistClient;
//# sourceMappingURL=cist-client.service.js.map