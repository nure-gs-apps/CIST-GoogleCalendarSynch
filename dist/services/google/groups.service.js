"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const inversify_1 = require("inversify");
const iterare_1 = require("iterare");
const types_1 = require("../../di/types");
const translit_1 = require("../../utils/translit");
const logger_service_1 = require("../logger.service");
const quota_limiter_service_1 = require("../quota-limiter.service");
const constants_1 = require("./constants");
const google_api_directory_1 = require("./google-api-directory");
let GroupsService = class GroupsService {
    constructor(googleApiDirectory, quotaLimiter) {
        this._directory = googleApiDirectory;
        this._groups = this._directory.googleDirectory.groups;
        this._quotaLimiter = quotaLimiter;
        this._insert = this._quotaLimiter.limiter.wrap(this._groups.insert.bind(this._groups));
        this._patch = this._quotaLimiter.limiter.wrap(this._groups.patch.bind(this._groups));
        this._delete = this._quotaLimiter.limiter.wrap(this._groups.delete.bind(this._groups));
        this._list = this._quotaLimiter.limiter.wrap(this._groups.list.bind(this._groups));
        this._cachedGroups = null;
        this._cacheLastUpdate = null;
    }
    get cachedGroups() {
        return this._cachedGroups;
    }
    get cacheLastUpdate() {
        return this._cacheLastUpdate
            ? new Date(this._cacheLastUpdate.getTime())
            : null;
    }
    async ensureGroups(cistResponse) {
        const groups = await this.getAllGroups();
        const promises = [];
        const insertedGroups = new Set();
        for (const faculty of cistResponse.university.faculties) {
            for (const direction of faculty.directions) {
                if (direction.groups) {
                    for (const cistGroup of direction.groups) {
                        const request = this.ensureGroup(groups, cistGroup, insertedGroups);
                        if (request) {
                            promises.push(request);
                        }
                    }
                }
                for (const speciality of direction.specialities) {
                    for (const cistGroup of speciality.groups) {
                        const request = this.ensureGroup(groups, cistGroup, insertedGroups);
                        if (request) {
                            promises.push(request);
                        }
                    }
                }
            }
        }
        this.clearCache();
        return Promise.all(promises);
    }
    async deleteAll() {
        const groups = await this.getAllGroups();
        const promises = [];
        for (const group of groups) {
            promises.push(this._delete({
                groupKey: group.id,
            }));
        }
        this.clearCache();
        return Promise.all(promises);
    }
    async deleteRelevant(cistResponse) {
        const groups = await this.getAllGroups();
        return this.doDeleteByIds(groups, iterare_1.iterate(groups).filter(g => {
            for (const faculty of cistResponse.university.faculties) {
                for (const direction of faculty.directions) {
                    if (direction.groups) {
                        const isRelevant = direction.groups.some(cistGroup => g.email === getGroupEmail(cistGroup));
                        if (isRelevant) {
                            return true;
                        }
                    }
                    for (const speciality of direction.specialities) {
                        const isRelevant = speciality.groups.some(cistGroup => g.email === getGroupEmail(cistGroup));
                        if (isRelevant) {
                            return true;
                        }
                    }
                }
            }
            return false;
        }).map(g => g.id).toSet());
    }
    async deleteIrrelevant(cistResponse) {
        const groups = await this.getAllGroups();
        return this.doDeleteByIds(groups, iterare_1.iterate(groups).filter(g => {
            for (const faculty of cistResponse.university.faculties) {
                for (const direction of faculty.directions) {
                    if (direction.groups) {
                        const isRelevant = direction.groups.some(cistGroup => g.email === getGroupEmail(cistGroup));
                        if (isRelevant) {
                            return false;
                        }
                    }
                    for (const speciality of direction.specialities) {
                        const isRelevant = speciality.groups.some(cistGroup => g.email === getGroupEmail(cistGroup));
                        if (isRelevant) {
                            return false;
                        }
                    }
                }
            }
            return true;
        }).map(g => g.id).toSet());
    }
    async getAllGroups(cacheResults = false) {
        let groups = [];
        let groupsPage = null;
        do {
            groupsPage = await this._list({
                customer: constants_1.customer,
                // maxResults: GroupsService.ROOMS_PAGE_SIZE,
                pageToken: groupsPage ? groupsPage.data.nextPageToken : null,
            });
            if (groupsPage.data.groups) {
                groups = groups.concat(groupsPage.data.groups);
            }
        } while (groupsPage.data.nextPageToken);
        if (cacheResults) {
            this._cachedGroups = groups;
            this._cacheLastUpdate = new Date();
        }
        return groups;
    }
    clearCache() {
        this._cachedGroups = null;
        this._cacheLastUpdate = null;
    }
    ensureGroup(groups, cistGroup, insertedGroups) {
        const googleGroupEmail = getGroupEmail(cistGroup);
        const googleGroup = groups.find(g => g.email === googleGroupEmail);
        if (googleGroup) {
            insertedGroups.add(googleGroupEmail);
            const groupPatch = cistGroupToGoogleGroupPatch(cistGroup, googleGroup);
            if (groupPatch) {
                logger_service_1.logger.debug(`Patching group ${cistGroup.name}`);
                return this._patch({
                    customer: constants_1.customer,
                    groupKey: googleGroupEmail,
                    requestBody: groupPatch,
                });
            }
            return null;
        }
        if (insertedGroups.has(googleGroupEmail)) {
            return null;
        }
        logger_service_1.logger.debug(`Inserting group ${cistGroup.name}`);
        insertedGroups.add(googleGroupEmail);
        return this._insert({
            requestBody: cistGroupToInsertGoogleGroup(cistGroup, googleGroupEmail),
        });
    }
    doDeleteByIds(groups, ids) {
        const promises = [];
        for (const group of groups) {
            if (ids.has(group.id)) {
                promises.push(this._delete({
                    groupKey: group.id,
                }));
            }
        }
        return Promise.all(promises);
    }
};
GroupsService.ROOMS_PAGE_SIZE = 200; // max limit
GroupsService = tslib_1.__decorate([
    inversify_1.injectable(),
    tslib_1.__param(0, inversify_1.inject(types_1.TYPES.GoogleApiDirectory)),
    tslib_1.__param(1, inversify_1.inject(types_1.TYPES.GoogleDirectoryQuotaLimiter)),
    tslib_1.__metadata("design:paramtypes", [google_api_directory_1.GoogleApiDirectory,
        quota_limiter_service_1.QuotaLimiterService])
], GroupsService);
exports.GroupsService = GroupsService;
function cistGroupToInsertGoogleGroup(cistGroup, email = getGroupEmail(cistGroup)) {
    return {
        email,
        name: cistGroup.name,
        description: cistGroup.name,
    };
}
function cistGroupToGoogleGroupPatch(cistGroup, googleGroup) {
    let hasChanges = false;
    const groupPatch = {};
    if (cistGroup.name !== googleGroup.name) {
        groupPatch.name = cistGroup.name;
        hasChanges = true;
    }
    if (cistGroup.name !== googleGroup.description) {
        groupPatch.name = cistGroup.name;
        hasChanges = true;
    }
    const email = getGroupEmail(cistGroup);
    if (email !== googleGroup.email) {
        groupPatch.email = email;
        hasChanges = true;
    }
    return hasChanges ? groupPatch : null;
}
exports.groupEmailPrefix = 'g';
function getGroupEmail(cistGroup) {
    const uniqueHash = cistGroup.id.toString();
    const localPartTemplate = [`${exports.groupEmailPrefix}_`, `.${uniqueHash}`];
    // is OK for google email, but causes collisions
    const groupName = translit_1.toTranslit(cistGroup.name, 64 - (localPartTemplate[0].length + localPartTemplate[1].length))
        .replace(/["(),:;<>@[\]\s]|[^\x00-\x7F]/g, '_')
        .toLowerCase();
    return `${localPartTemplate.join(groupName)}@${constants_1.domainName}`;
}
exports.getGroupEmail = getGroupEmail;
// // There is another way of making a unique hash
// // is Unique but too long and unneeded
// const uniqueHash = toBase64(cistGroup.name)
//   .split('')
//   .map(c => v.isAlpha(c) && v.isUpperCase(c) ? `_${c.toLowerCase()}` : c)
//   .join('');
//# sourceMappingURL=groups.service.js.map