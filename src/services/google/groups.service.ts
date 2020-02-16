import { admin_directory_v1 } from 'googleapis';
import { inject, injectable } from 'inversify';
import { iterate } from 'iterare';
import { Nullable } from '../../@types';
import { TYPES } from '../../di/types';
import { ApiGroup, ApiGroupsResponse } from '../cist-json-client.service';
import { logger } from '../logger.service';
import { QuotaLimiterService } from '../quota-limiter.service';
import { customer } from './constants';
import { GoogleApiDirectory } from './google-api-directory';
import Schema$Group = admin_directory_v1.Schema$Group;
import Resource$Groups = admin_directory_v1.Resource$Groups;
import { GaxiosPromise } from 'gaxios';
import { isSameGroupIdenity, UtilsService } from './utils.service';

@injectable()
export class GroupsService {
  static readonly ROOMS_PAGE_SIZE = 200; // max limit
  private readonly _utils: UtilsService;
  private readonly _directory: GoogleApiDirectory;
  private readonly _quotaLimiter: QuotaLimiterService;

  private readonly _groups: Resource$Groups;

  private readonly _insert: Resource$Groups['insert'];
  private readonly _patch: Resource$Groups['patch'];
  private readonly _delete: Resource$Groups['delete'];
  private readonly _list: Resource$Groups['list'];

  private _cachedGroups: Nullable<Schema$Group[]>;
  private _cacheLastUpdate: Nullable<Date>;

  get cachedGroups() {
    return this._cachedGroups as Nullable<ReadonlyArray<Schema$Group>>;
  }
  get cacheLastUpdate() {
    return this._cacheLastUpdate
      ? new Date(this._cacheLastUpdate.getTime())
      : null;
  }

  constructor(
    @inject(TYPES.GoogleApiDirectory) googleApiDirectory: GoogleApiDirectory,
    @inject(
      TYPES.GoogleDirectoryQuotaLimiter,
    ) quotaLimiter: QuotaLimiterService,
    @inject(TYPES.GoogleUtils) utils: UtilsService,
  ) {
    this._utils = utils;

    this._directory = googleApiDirectory;
    this._groups = this._directory.googleDirectory.groups;
    this._quotaLimiter = quotaLimiter;

    this._insert = this._quotaLimiter.limiter.wrap(
      this._groups.insert.bind(this._groups),
    ) as any;
    this._patch = this._quotaLimiter.limiter.wrap(
      this._groups.patch.bind(this._groups),
    ) as any;
    this._delete = this._quotaLimiter.limiter.wrap(
      this._groups.delete.bind(this._groups),
    ) as any;
    this._list = this._quotaLimiter.limiter.wrap(
      this._groups.list.bind(this._groups),
    ) as any;

    this._cachedGroups = null;
    this._cacheLastUpdate = null;
  }

  async ensureGroups(
    cistResponse: ApiGroupsResponse,
    preserveEmailChanges = false,
  ) {
    const groups = await this.getAllGroups();

    const newToOldNames = preserveEmailChanges
      ? new Map<string, string>()
      : null;
    const promises = [] as GaxiosPromise<any>[];
    const insertedGroups = new Set<string>();
    for (const faculty of cistResponse.university.faculties) {
      for (const direction of faculty.directions) {
        if (direction.groups) {
          for (const cistGroup of direction.groups) {
            const request = this.ensureGroup(
              groups,
              cistGroup,
              insertedGroups,
              newToOldNames,
            );
            if (request) {
              promises.push(request);
            }
          }
        }
        for (const speciality of direction.specialities) {
          for (const cistGroup of speciality.groups) {
            const request = this.ensureGroup(
              groups,
              cistGroup,
              insertedGroups,
              newToOldNames,
            );
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
    const groups = await this.getAllGroups();
    const promises = [];
    for (const group of groups) {
      promises.push(this._delete({
        groupKey: group.id ?? undefined,
      }));
    }
    this.clearCache();
    return Promise.all(promises);
  }

  async deleteRelevant(cistResponse: ApiGroupsResponse) {
    const groups = await this.getAllGroups();
    return this.doDeleteByIds(
      groups,
      iterate(groups).filter(g => {
        for (const faculty of cistResponse.university.faculties) {
          for (const direction of faculty.directions) {
            if (direction.groups) {
              const isRelevant = direction.groups.some(
                cistGroup =>   isSameGroupIdenity(cistGroup, g),
              );
              if (isRelevant) {
                return true;
              }
            }
            for (const speciality of direction.specialities) {
              const isRelevant = speciality.groups.some(
                cistGroup => isSameGroupIdenity(cistGroup, g),
              );
              if (isRelevant) {
                return true;
              }
            }
          }
        }
        return false;
        // tslint:disable-next-line:no-non-null-assertion
      }).map(g => g.id!).toSet(),
    );
  }

  async deleteIrrelevant(cistResponse: ApiGroupsResponse) {
    const groups = await this.getAllGroups();
    return this.doDeleteByIds(
      groups,
      iterate(groups).filter(g => {
        for (const faculty of cistResponse.university.faculties) {
          for (const direction of faculty.directions) {
            if (direction.groups) {
              const isRelevant = direction.groups.some(
                cistGroup => isSameGroupIdenity(cistGroup, g),
              );
              if (isRelevant) {
                return false;
              }
            }
            for (const speciality of direction.specialities) {
              const isRelevant = speciality.groups.some(
                cistGroup => isSameGroupIdenity(cistGroup, g),
              );
              if (isRelevant) {
                return false;
              }
            }
          }
        }
        return true;
        // tslint:disable-next-line:no-non-null-assertion
      }).map(g => g.id!).toSet(),
    );
  }

  async getAllGroups(cacheResults = false) {
    let groups = [] as Schema$Group[];
    let groupsPage = null;
    do {
      groupsPage = await this._list({
        customer,
        // maxResults: GroupsService.ROOMS_PAGE_SIZE,
        pageToken: groupsPage ? groupsPage.data.nextPageToken : null, // BUG in typedefs
      } as any);
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

  private ensureGroup(
    groups: ReadonlyArray<Schema$Group>,
    cistGroup: ApiGroup,
    insertedGroups: Set<string>,
    newToOldNames: Nullable<Map<string, string>>,
  ) {
    const googleGroupEmail = this._utils.getGroupEmail(cistGroup);
    const googleGroup = groups.find(
      g => isSameGroupIdenity(cistGroup, g),
    );
    if (googleGroup) {
      insertedGroups.add(googleGroupEmail);
      const groupPatch = this.cistGroupToGoogleGroupPatch(
        cistGroup,
        googleGroup,
      );
      if (groupPatch) {
        if (newToOldNames && groupPatch.name) {
          // tslint:disable-next-line:no-non-null-assertion
          newToOldNames.set(groupPatch.name, googleGroup.name!);
        }
        logger.debug(`Patching group ${cistGroup.name}`);
        return this._patch({
          customer,
          groupKey: googleGroupEmail,
          requestBody: groupPatch,
        } as admin_directory_v1.Params$Resource$Groups$Patch);
      }
      return null;
    }
    if (insertedGroups.has(googleGroupEmail)) {
      return null;
    }
    logger.debug(`Inserting group ${cistGroup.name}`);
    insertedGroups.add(googleGroupEmail);
    return this._insert({
      requestBody: this.cistGroupToInsertGoogleGroup(cistGroup, googleGroupEmail),
    });
  }

  private doDeleteByIds(groups: ReadonlyArray<Schema$Group>, ids: Set<string>) {
    const promises = [];
    for (const group of groups) {
      // tslint:disable-next-line:no-non-null-assertion
      if (ids.has(group.id!)) {
        promises.push(
          this._delete({
            groupKey: group.id ?? undefined,
          }),
        );
      }
    }
    return Promise.all(promises);
  }

  private cistGroupToInsertGoogleGroup(
    cistGroup: ApiGroup,
    email = this._utils.getGroupEmail(cistGroup),
  ): Schema$Group {
    return {
      email, // TODO: integrate with existing if any
      name: cistGroup.name,
      description: cistGroup.name, // TODO: add faculty, direction and speciality info
    };
  }

  private cistGroupToGoogleGroupPatch(
    cistGroup: ApiGroup,
    googleGroup: Schema$Group,
  ) {
    let hasChanges = false;
    const groupPatch = {} as Schema$Group;
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
}
