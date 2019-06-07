"use strict";
var GroupsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
"use strict";
const inversify_1 = require("inversify");
const types_1 = require("../../di/types");
const constants_1 = require("./constants");
const google_api_directory_1 = require("./google-api-directory");
let GroupsService = GroupsService_1 = class GroupsService {
    constructor(googleAdmin) {
        this._admin = googleAdmin;
        this._groups = this._admin.googleAdmin.groups;
    }
    async ensureGroups(cistResponse) {
    }
    async loadGroups() {
        let groups = [];
        let groupsPage = null;
        do {
            groupsPage = await this._groups.list({
                customer: constants_1.customer,
                maxResults: GroupsService_1.ROOMS_PAGE_SIZE,
                nextPage: groupsPage ? groupsPage.data.nextPageToken : null,
            });
            if (groupsPage.data.groups) {
                groups = groups.concat(groupsPage.data.groups);
            }
        } while (groupsPage.data.nextPageToken);
        return groups;
    }
};
GroupsService.ROOMS_PAGE_SIZE = 1000;
GroupsService = GroupsService_1 = tslib_1.__decorate([
    inversify_1.injectable(),
    tslib_1.__param(0, inversify_1.inject(types_1.TYPES.GoogleApiAdmin)),
    tslib_1.__metadata("design:paramtypes", [google_api_directory_1.GoogleApiDirectory])
], GroupsService);
exports.GroupsService = GroupsService;
//# sourceMappingURL=groups.service.js.map