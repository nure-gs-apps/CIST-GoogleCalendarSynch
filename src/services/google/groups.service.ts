import { admin_directory_v1 } from 'googleapis';
import { inject, injectable } from 'inversify';
import { iterate } from 'iterare';
import { Nullable } from '../../@types';
import { TYPES } from '../../di/types';
import { toTranslit } from '../../utils/translit';
import { ApiGroup, ApiGroupResponse } from '../cist-json-client.service';
import { logger } from '../logger.service';
import { QuotaLimiterService } from '../quota-limiter.service';
import { customer, domainName, idPrefix } from './constants';
import { GoogleApiDirectory } from './google-api-directory';
import Schema$Group = admin_directory_v1.Schema$Group;
import Resource$Groups = admin_directory_v1.Resource$Groups;
import { GaxiosPromise } from 'gaxios';

@injectable()
export class GroupsService {
  static readonly ROOMS_PAGE_SIZE = 1000;
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
  ) {
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

  async ensureGroups(cistResponse: ApiGroupResponse) {
    const groups = await this.getAllGroups();

    const promises = [] as GaxiosPromise<any>[];
    for (const faculty of cistResponse.university.faculties) {
      for (const direction of faculty.directions) {
        if (direction.groups) {
          for (const cistGroup of direction.groups) {
            const request = this.ensureGroup(groups, cistGroup);
            if (request) {
              promises.push(request);
            }
          }
        }
        for (const speciality of direction.specialities) {
          for (const cistGroup of speciality.groups) {
            const request = this.ensureGroup(groups, cistGroup);
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

  async deleteRelevant(cistResponse: ApiGroupResponse) {
    const groups = await this.getAllGroups();
    return this.doDeleteByIds(
      groups,
      iterate(groups).filter(g => {
        for (const faculty of cistResponse.university.faculties) {
          for (const direction of faculty.directions) {
            if (direction.groups) {
              const isRelevant = direction.groups.some(
                cistGroup => g.id === getGoogleGroupId(cistGroup),
              );
              if (isRelevant) {
                return true;
              }
            }
            for (const speciality of direction.specialities) {
              const isRelevant = speciality.groups.some(
                cistGroup => g.id === getGoogleGroupId(cistGroup),
              );
              if (isRelevant) {
                return true;
              }
            }
          }
        }
        return false;
      }).map(g => g.id!).toSet(),
    );
  }

  async deleteIrrelevant(cistResponse: ApiGroupResponse) {
    const groups = await this.getAllGroups();
    return this.doDeleteByIds(
      groups,
      iterate(groups).filter(g => {
        for (const faculty of cistResponse.university.faculties) {
          for (const direction of faculty.directions) {
            if (direction.groups) {
              const isIrrelevant = !direction.groups.some(
                cistGroup => g.id === getGoogleGroupId(cistGroup),
              );
              if (isIrrelevant) {
                return true;
              }
            }
            for (const speciality of direction.specialities) {
              const isIrrelevant = !speciality.groups.some(
                cistGroup => g.id === getGoogleGroupId(cistGroup),
              );
              if (isIrrelevant) {
                return true;
              }
            }
          }
        }
        return false;
      }).map(g => g.id!).toSet(),
    );
  }

  async getAllGroups(cacheResults = false) {
    let groups = [] as Schema$Group[];
    let groupsPage = null;
    do {
      groupsPage = await this._groups.list({
        customer,
        maxResults: GroupsService.ROOMS_PAGE_SIZE,
        nextPage: groupsPage ? groupsPage.data.nextPageToken : null,
      } as admin_directory_v1.Params$Resource$Groups$List);
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
  ) {
    const googleGroupId = getGoogleGroupId(cistGroup);
    const googleGroup = groups.find(
      g => g.id === googleGroupId,
    );
    if (googleGroup) {
      const groupPatch = cistGroupToGoogleGroupPatch(
        cistGroup,
        googleGroup,
      );
      if (groupPatch) {
        logger.debug(`Patching group ${cistGroup.name}`);
        return this._patch({
          customer,
          groupKey: googleGroupId,
          requestBody: groupPatch,
        } as admin_directory_v1.Params$Resource$Groups$Patch);
      }
      return null;
    }
    logger.debug(`Inserting group ${cistGroup.name}`);
    return this._insert({
      requestBody: cistGroupToInsertGoogleGroup(cistGroup, googleGroupId),
    });
  }

  private doDeleteByIds(groups: ReadonlyArray<Schema$Group>, ids: Set<string>) {
    const promises = [];
    for (const group of groups) {
      if (ids.has(group.id!)) {
        promises.push(
          this._delete({
            groupKey: group.id,
          }),
        );
      }
    }
    return Promise.all(promises);
  }
}

function cistGroupToInsertGoogleGroup(
  cistGroup: ApiGroup,
  id = getGoogleGroupId(cistGroup),
): Schema$Group {
  return {
    id,
    name: cistGroup.name,
    description: cistGroup.name,
    email: getGroupEmail(cistGroup), // TODO: integrate with existing if any
  };
}

function cistGroupToGoogleGroupPatch(
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
  const email = getGroupEmail(cistGroup);
  if (email !== googleGroup.email) {
    groupPatch.email = email;
    hasChanges = true;
  }
  return hasChanges ? groupPatch : null;
}

export const groupIdPrefix = 'g';
export function getGoogleGroupId(cistGroup: ApiGroup) {
  return `${idPrefix}.${groupIdPrefix}.${toTranslit(cistGroup.id.toString())}`;
}

export function getGroupEmail(cistGroup: ApiGroup) {
  return `${toTranslit(cistGroup.name)}@${domainName}`;
}
