"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const inversify_1 = require("inversify");
const iterare_1 = require("iterare");
const types_1 = require("../../di/types");
const logger_service_1 = require("../logger.service");
const quota_limiter_service_1 = require("../quota-limiter.service");
const constants_1 = require("./constants");
const google_api_directory_1 = require("./google-api-directory");
const utils_service_1 = require("./utils.service");
let GroupsService = class GroupsService {
    constructor(googleApiDirectory, quotaLimiter, utils) {
        Object.defineProperty(this, "_utils", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: _utils
        });
        Object.defineProperty(this, "_directory", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: _directory
        });
        Object.defineProperty(this, "_quotaLimiter", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: _quotaLimiter
        });
        Object.defineProperty(this, "_groups", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: _groups
        });
        Object.defineProperty(this, "_insert", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: _insert
        });
        Object.defineProperty(this, "_patch", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: _patch
        });
        Object.defineProperty(this, "_delete", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: _delete
        });
        Object.defineProperty(this, "_list", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: _list
        });
        Object.defineProperty(this, "_cachedGroups", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: _cachedGroups
        });
        Object.defineProperty(this, "_cacheLastUpdate", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: _cacheLastUpdate
        });
        this._utils = utils;
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
    async ensureGroups(cistResponse, preserveEmailChanges = false) {
        const groups = await this.getAllGroups();
        const newToOldNames = preserveEmailChanges
            ? new Map()
            : null;
        const promises = [];
        const insertedGroups = new Set();
        for (const faculty of cistResponse.university.faculties) {
            for (const direction of faculty.directions) {
                if (direction.groups) {
                    for (const cistGroup of direction.groups) {
                        const request = this.ensureGroup(groups, cistGroup, insertedGroups, newToOldNames);
                        if (request) {
                            promises.push(request);
                        }
                    }
                }
                for (const speciality of direction.specialities) {
                    for (const cistGroup of speciality.groups) {
                        const request = this.ensureGroup(groups, cistGroup, insertedGroups, newToOldNames);
                        if (request) {
                            promises.push(request);
                        }
                    }
                }
            }
        }
        this.clearCache();
        await Promise.all(promises);
        return newToOldNames;
    }
    async deleteAll() {
        var _a;
        const groups = await this.getAllGroups();
        const promises = [];
        for (const group of groups) {
            promises.push(this._delete({
                groupKey: (_a = group.id, (_a !== null && _a !== void 0 ? _a : undefined)),
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
                        const isRelevant = direction.groups.some(cistGroup => utils_service_1.isSameGroupIdenity(cistGroup, g));
                        if (isRelevant) {
                            return true;
                        }
                    }
                    for (const speciality of direction.specialities) {
                        const isRelevant = speciality.groups.some(cistGroup => utils_service_1.isSameGroupIdenity(cistGroup, g));
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
    async deleteIrrelevant(cistResponse) {
        const groups = await this.getAllGroups();
        return this.doDeleteByIds(groups, iterare_1.iterate(groups).filter(g => {
            for (const faculty of cistResponse.university.faculties) {
                for (const direction of faculty.directions) {
                    if (direction.groups) {
                        const isRelevant = direction.groups.some(cistGroup => utils_service_1.isSameGroupIdenity(cistGroup, g));
                        if (isRelevant) {
                            return false;
                        }
                    }
                    for (const speciality of direction.specialities) {
                        const isRelevant = speciality.groups.some(cistGroup => utils_service_1.isSameGroupIdenity(cistGroup, g));
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
    ensureGroup(groups, cistGroup, insertedGroups, newToOldNames) {
        const googleGroupEmail = this._utils.getGroupEmail(cistGroup);
        const googleGroup = groups.find(g => utils_service_1.isSameGroupIdenity(cistGroup, g));
        if (googleGroup) {
            insertedGroups.add(googleGroupEmail);
            const groupPatch = this.cistGroupToGoogleGroupPatch(cistGroup, googleGroup);
            if (groupPatch) {
                if (newToOldNames && groupPatch.name) {
                    // tslint:disable-next-line:no-non-null-assertion
                    newToOldNames.set(groupPatch.name, googleGroup.name);
                }
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
            requestBody: this.cistGroupToInsertGoogleGroup(cistGroup, googleGroupEmail),
        });
    }
    doDeleteByIds(groups, ids) {
        var _a;
        const promises = [];
        for (const group of groups) {
            // tslint:disable-next-line:no-non-null-assertion
            if (ids.has(group.id)) {
                promises.push(this._delete({
                    groupKey: (_a = group.id, (_a !== null && _a !== void 0 ? _a : undefined)),
                }));
            }
        }
        return Promise.all(promises);
    }
    cistGroupToInsertGoogleGroup(cistGroup, email = this._utils.getGroupEmail(cistGroup)) {
        return {
            email,
            name: cistGroup.name,
            description: cistGroup.name,
        };
    }
    cistGroupToGoogleGroupPatch(cistGroup, googleGroup) {
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
        const email = this._utils.getGroupEmail(cistGroup);
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
GroupsService = tslib_1.__decorate([
    inversify_1.injectable(),
    tslib_1.__param(0, inversify_1.inject(types_1.TYPES.GoogleApiDirectory)),
    tslib_1.__param(1, inversify_1.inject(types_1.TYPES.GoogleDirectoryQuotaLimiter)),
    tslib_1.__param(2, inversify_1.inject(types_1.TYPES.GoogleUtils)),
    tslib_1.__metadata("design:paramtypes", [google_api_directory_1.GoogleApiDirectory,
        quota_limiter_service_1.QuotaLimiterService,
        utils_service_1.UtilsService])
], GroupsService);
exports.GroupsService = GroupsService;
//# sourceMappingURL=groups.service.js.map