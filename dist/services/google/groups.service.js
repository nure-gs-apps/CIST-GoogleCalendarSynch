"use strict";
var GroupsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const inversify_1 = require("inversify");
const iterare_1 = require("iterare");
const _types_1 = require("../../@types");
const tasks_1 = require("../../@types/tasks");
const types_1 = require("../../di/types");
const cist_1 = require("../../utils/cist");
const quota_limiter_service_1 = require("../quota-limiter.service");
const constants_1 = require("./constants");
const errors_1 = require("./errors");
const google_api_admin_directory_1 = require("./google-api-admin-directory");
const google_utils_service_1 = require("./google-utils.service");
let GroupsService = GroupsService_1 = class GroupsService {
    constructor(googleApiAdminDirectory, quotaLimiter, utils, logger) {
        Object.defineProperty(this, "_directory", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "_quotaLimiter", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "_utils", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "_logger", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "_groups", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "_insert", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "_patch", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "_delete", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "_list", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this._utils = utils;
        this._logger = logger;
        this._directory = googleApiAdminDirectory;
        this._groups = this._directory.googleAdminDirectory.groups;
        this._quotaLimiter = quotaLimiter;
        this._insert = this._quotaLimiter.limiter.wrap(this._groups.insert.bind(this._groups));
        this._patch = this._quotaLimiter.limiter.wrap(this._groups.patch.bind(this._groups));
        this._delete = this._quotaLimiter.limiter.wrap(this._groups.delete.bind(this._groups));
        this._list = this._quotaLimiter.limiter.wrap(this._groups.list.bind(this._groups));
    }
    /**
     * Doesn't handle errors properly
     */
    async ensureGroups(cistResponse) {
        const groups = await this.getAllGroups();
        await Promise.all(iterare_1.iterate(cist_1.toGroupDataMap(cistResponse).values())
            .map(cistGroupData => this.doEnsureGroup(cistGroupData, groups.find(g => google_utils_service_1.isSameGroupIdentity(cistGroupData.group, g)))));
    }
    async createGroupsTaskContext(cistResponse) {
        return {
            cistGroupsMap: cist_1.toGroupDataMap(cistResponse),
            googleGroupsMap: iterare_1.iterate(await this.getAllGroups())
                .filter(g => typeof g.email === 'string')
                .map(g => _types_1.t(g.email, g))
                .toMap()
        };
    }
    createEnsureGroupsTask(cistResponse) {
        return {
            taskType: tasks_1.TaskType.EnsureGroups,
            steps: Array.from(cist_1.toGroupsMap(cistResponse).keys())
        };
    }
    async ensureGroup(cistGroupId, context) {
        const cistGroupData = context.cistGroupsMap.get(cistGroupId);
        if (!cistGroupData) {
            throw new errors_1.FatalError(`Group ${cistGroupId} is not found in the context`);
        }
        await this.doEnsureGroup(cistGroupData, context.googleGroupsMap.get(this._utils.getGroupEmail(cistGroupData.group)));
    }
    /**
     * Doesn't handle errors properly
     */
    async deleteAll() {
        const groups = await this.getAllGroups();
        const promises = [];
        for (const group of groups) {
            if (group.id) {
                promises.push(this.doDeleteById(group.id));
            }
        }
        return Promise.all(promises);
    }
    /**
     * Doesn't handle errors properly
     */
    async deleteIrrelevant(cistResponse) {
        const groups = await this.getAllGroups();
        return this.doDeleteByIds(groups, iterare_1.iterate(groups).filter(g => {
            for (const faculty of cistResponse.university.faculties) {
                for (const direction of faculty.directions) {
                    if (direction.groups) {
                        const isRelevant = direction.groups.some(cistGroup => google_utils_service_1.isSameGroupIdentity(cistGroup, g));
                        if (isRelevant) {
                            return false;
                        }
                    }
                    for (const speciality of direction.specialities) {
                        const isRelevant = speciality.groups.some(cistGroup => google_utils_service_1.isSameGroupIdentity(cistGroup, g));
                        if (isRelevant) {
                            return false;
                        }
                    }
                }
            }
            return true;
            // tslint:disable-next-line:no-non-null-assertion
        }).map(g => g.id).toSet());
    }
    createDeleteIrrelevantTask(context) {
        return {
            taskType: tasks_1.TaskType.DeleteIrrelevantGroups,
            steps: iterare_1.iterate(context.googleGroupsMap.keys())
                .filter(email => !context.cistGroupsMap.has(this._utils.getGroupIdFromEmail(email)))
                .toArray()
        };
    }
    async deleteGroupById(groupIdOrEmail) {
        return this.doDeleteById(groupIdOrEmail);
    }
    /**
     * Doesn't handle errors properly
     */
    async deleteRelevant(cistResponse) {
        const groups = await this.getAllGroups();
        return this.doDeleteByIds(groups, iterare_1.iterate(groups).filter(g => {
            for (const faculty of cistResponse.university.faculties) {
                for (const direction of faculty.directions) {
                    if (direction.groups) {
                        const isRelevant = direction.groups.some(cistGroup => google_utils_service_1.isSameGroupIdentity(cistGroup, g));
                        if (isRelevant) {
                            return true;
                        }
                    }
                    for (const speciality of direction.specialities) {
                        const isRelevant = speciality.groups.some(cistGroup => google_utils_service_1.isSameGroupIdentity(cistGroup, g));
                        if (isRelevant) {
                            return true;
                        }
                    }
                }
            }
            return false;
            // tslint:disable-next-line:no-non-null-assertion
        }).map(g => g.id).toSet());
    }
    async getAllGroups() {
        let groups = [];
        let groupsPage = null;
        do {
            groupsPage = await this._list({
                customer: constants_1.customer,
                maxResults: GroupsService_1.ROOMS_PAGE_SIZE,
                pageToken: groupsPage ? groupsPage.data.nextPageToken : null,
            });
            if (groupsPage.data.groups) {
                groups = groups.concat(groupsPage.data.groups);
                this._logger.info(`Loaded ${groups.length} groups...`);
            }
        } while (groupsPage.data.nextPageToken);
        this._logger.info(`All ${groups.length} groups loaded!`);
        return groups;
    }
    doEnsureGroup(cistGroupData, googleGroup) {
        if (googleGroup) {
            const groupPatch = this.cistGroupToGoogleGroupPatch(cistGroupData, googleGroup);
            if (groupPatch) {
                return Promise.resolve(this._patch({
                    customer: constants_1.customer,
                    groupKey: this._utils.getGroupEmail(cistGroupData.group),
                    requestBody: groupPatch,
                })).tap(() => this._logger.info(`Patched group ${cistGroupData.group.name}`));
            }
            this._logger.info(`No changes in group ${cistGroupData.group.name}`);
            return Promise.resolve(null);
        }
        return Promise.resolve(this._insert({
            requestBody: this.cistGroupToInsertGoogleGroup(cistGroupData),
        })).tap(() => this._logger.info(`Inserted group ${cistGroupData.group.name}`));
    }
    doDeleteByIds(groups, ids) {
        const promises = [];
        for (const group of groups) {
            // tslint:disable-next-line:no-non-null-assertion
            if (ids.has(group.id)) {
                // tslint:disable-next-line:no-non-null-assertion
                promises.push(this.doDeleteById(group.email));
            }
        }
        return Promise.all(promises);
    }
    doDeleteById(groupEmailOrId) {
        return this._delete({
            groupKey: groupEmailOrId,
        });
    }
    cistGroupToInsertGoogleGroup(cistGroupData, email = this._utils.getGroupEmail(cistGroupData.group)) {
        return {
            email,
            name: cistGroupData.group.name,
            description: getDescription(cistGroupData),
        };
    }
    cistGroupToGoogleGroupPatch(cistGroupData, googleGroup) {
        let hasChanges = false;
        const groupPatch = {};
        if (cistGroupData.group.name !== googleGroup.name) {
            groupPatch.name = cistGroupData.group.name;
            hasChanges = true;
        }
        const description = getDescription(cistGroupData);
        if (description !== googleGroup.description) {
            groupPatch.description = description;
            hasChanges = true;
        }
        const email = this._utils.getGroupEmail(cistGroupData.group);
        if (email !== googleGroup.email) {
            groupPatch.email = email;
            hasChanges = true;
        }
        return hasChanges ? groupPatch : null;
    }
};
Object.defineProperty(GroupsService, "ROOMS_PAGE_SIZE", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: 200
}); // max limit
GroupsService = GroupsService_1 = tslib_1.__decorate([
    inversify_1.injectable(),
    tslib_1.__param(0, inversify_1.inject(types_1.TYPES.GoogleApiAdminDirectory)),
    tslib_1.__param(1, inversify_1.inject(types_1.TYPES.GoogleAdminDirectoryQuotaLimiter)),
    tslib_1.__param(2, inversify_1.inject(types_1.TYPES.GoogleUtils)),
    tslib_1.__param(3, inversify_1.inject(types_1.TYPES.Logger)),
    tslib_1.__metadata("design:paramtypes", [google_api_admin_directory_1.GoogleApiAdminDirectory,
        quota_limiter_service_1.QuotaLimiterService,
        google_utils_service_1.GoogleUtilsService, Object])
], GroupsService);
exports.GroupsService = GroupsService;
function getDescription(cistGroupData) {
    let description = `${cistGroupData.group.name}, faculty "${cistGroupData.faculty.full_name}" (${cistGroupData.faculty.short_name}), direction "${cistGroupData.direction.full_name}" (${cistGroupData.direction.short_name})`;
    if (cistGroupData.speciality) {
        description += `, speciality "${cistGroupData.speciality.full_name}" (${cistGroupData.speciality.short_name})`;
    }
    return description;
}
//# sourceMappingURL=groups.service.js.map