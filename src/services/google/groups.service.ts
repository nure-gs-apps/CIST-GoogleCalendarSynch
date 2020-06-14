import { admin_directory_v1 } from 'googleapis';
import { inject, injectable } from 'inversify';
import { iterate } from 'iterare';
import { DeepReadonly, DeepReadonlyMap, Maybe, t } from '../../@types';
import { CistGroupsResponse } from '../../@types/cist';
import { ICistGroupData } from '../../@types/google';
import { ILogger } from '../../@types/logging';
import { ITaskDefinition, TaskType } from '../../@types/tasks';
import { TYPES } from '../../di/types';
import { toGroupDataMap, toGroupsMap } from '../../utils/cist';
import { QuotaLimiterService } from '../quota-limiter.service';
import { customer } from './constants';
import { FatalError } from './errors';
import { GoogleApiAdminDirectory } from './google-api-admin-directory';
import {
  GoogleUtilsService,
  isSameGroupIdentity,
} from './google-utils.service';
import Resource$Groups = admin_directory_v1.Resource$Groups;
import Schema$Group = admin_directory_v1.Schema$Group;

export interface IGroupsTaskContext {
  readonly cistGroupsMap: DeepReadonlyMap<number, ICistGroupData>;
  readonly googleGroupsMap: DeepReadonlyMap<string, Schema$Group>;
}

@injectable()
export class GroupsService {
  static readonly ROOMS_PAGE_SIZE = 200; // max limit
  private readonly _directory: GoogleApiAdminDirectory;
  private readonly _quotaLimiter: QuotaLimiterService;
  private readonly _utils: GoogleUtilsService;
  private readonly _logger: ILogger;

  private readonly _groups: Resource$Groups;

  private readonly _insert: Resource$Groups['insert'];
  private readonly _patch: Resource$Groups['patch'];
  private readonly _delete: Resource$Groups['delete'];
  private readonly _list: Resource$Groups['list'];

  constructor(
    @inject(
      TYPES.GoogleApiAdminDirectory
    ) googleApiAdminDirectory: GoogleApiAdminDirectory,
    @inject(
      TYPES.GoogleAdminDirectoryQuotaLimiter,
    ) quotaLimiter: QuotaLimiterService,
    @inject(TYPES.GoogleUtils) utils: GoogleUtilsService,
    @inject(TYPES.Logger) logger: ILogger,
  ) {
    this._utils = utils;
    this._logger = logger;

    this._directory = googleApiAdminDirectory;
    this._groups = this._directory.googleAdminDirectory.groups;
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
  }

  /**
   * Doesn't handle errors properly
   */
  async ensureGroups(cistResponse: DeepReadonly<CistGroupsResponse>) {
    const groups = await this.getAllGroups();

    await Promise.all(iterate(toGroupDataMap(cistResponse).values())
      .map(cistGroupData => this.doEnsureGroup(cistGroupData, groups.find(
        g => isSameGroupIdentity(cistGroupData.group, g),
      ))));
  }

  async createGroupsTaskContext(
    cistResponse: DeepReadonly<CistGroupsResponse>
  ): Promise<IGroupsTaskContext> {
    return {
      cistGroupsMap: toGroupDataMap(cistResponse),
      googleGroupsMap: iterate(await this.getAllGroups())
        .filter(g => typeof g.email === 'string')
        .map(g => t(g.email as string, g))
        .toMap()
    };
  }

  createEnsureGroupsTask(
    cistResponse: DeepReadonly<CistGroupsResponse>
  ): ITaskDefinition<number> {
    return {
      taskType: TaskType.EnsureGroups,
      steps: Array.from(toGroupsMap(cistResponse).keys())
    };
  }

  async ensureGroup(
    cistGroupId: number,
    context: IGroupsTaskContext,
  ) {
    const cistGroupData = context.cistGroupsMap.get(cistGroupId);
    if (!cistGroupData) {
      throw new FatalError(`Group ${cistGroupId} is not found in the context`);
    }
    await this.doEnsureGroup(
      cistGroupData,
      context.googleGroupsMap.get(
        this._utils.getGroupEmail(cistGroupData.group)
      ),
    );
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
  async deleteIrrelevant(cistResponse: DeepReadonly<CistGroupsResponse>) {
    const groups = await this.getAllGroups();
    return this.doDeleteByIds(
      groups,
      iterate(groups).filter(g => {
        for (const faculty of cistResponse.university.faculties) {
          for (const direction of faculty.directions) {
            if (direction.groups) {
              const isRelevant = direction.groups.some(
                cistGroup => isSameGroupIdentity(cistGroup, g),
              );
              if (isRelevant) {
                return false;
              }
            }
            for (const speciality of direction.specialities) {
              const isRelevant = speciality.groups.some(
                cistGroup => isSameGroupIdentity(cistGroup, g),
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

  createDeleteIrrelevantTask(
    context: IGroupsTaskContext
  ): ITaskDefinition<string> {
    return {
      taskType: TaskType.DeleteIrrelevantGroups,
      steps: iterate(context.googleGroupsMap.keys())
        .filter(email => !context.cistGroupsMap.has(
          this._utils.getGroupIdFromEmail(email)
        ))
        .toArray()
    };
  }

  async deleteGroupById(groupIdOrEmail: string) {
    return this.doDeleteById(groupIdOrEmail);
  }

  /**
   * Doesn't handle errors properly
   */
  async deleteRelevant(cistResponse: DeepReadonly<CistGroupsResponse>) {
    const groups = await this.getAllGroups();
    return this.doDeleteByIds(
      groups,
      iterate(groups).filter(g => {
        for (const faculty of cistResponse.university.faculties) {
          for (const direction of faculty.directions) {
            if (direction.groups) {
              const isRelevant = direction.groups.some(
                cistGroup => isSameGroupIdentity(cistGroup, g),
              );
              if (isRelevant) {
                return true;
              }
            }
            for (const speciality of direction.specialities) {
              const isRelevant = speciality.groups.some(
                cistGroup => isSameGroupIdentity(cistGroup, g),
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

  async getAllGroups() {
    let groups = [] as Schema$Group[];
    let groupsPage = null;
    do {
      groupsPage = await this._list({
        customer,
        maxResults: GroupsService.ROOMS_PAGE_SIZE,
        pageToken: groupsPage ? groupsPage.data.nextPageToken : null, // BUG in typedefs
      } as any);
      if (groupsPage.data.groups) {
        groups = groups.concat(groupsPage.data.groups);
        this._logger.info(`Loaded ${groups.length} Google groups...`);
      }
    } while (groupsPage.data.nextPageToken);
    this._logger.info(`All ${groups.length} Google groups loaded!`);
    return groups;
  }

  private doEnsureGroup(
    cistGroupData: ICistGroupData,
    googleGroup: Maybe<DeepReadonly<Schema$Group>>,
  ) {
    if (googleGroup) {
      const groupPatch = this.cistGroupToGoogleGroupPatch(
        cistGroupData,
        googleGroup,
      );
      if (groupPatch) {
        return Promise.resolve(this._patch({
          customer,
          groupKey: this._utils.getGroupEmail(cistGroupData.group),
          requestBody: groupPatch,
        } as admin_directory_v1.Params$Resource$Groups$Patch)).tap(
          () => this._logger.info(`Patched group ${cistGroupData.group.name}`)
        );
      }
      this._logger.info(`No changes in group ${cistGroupData.group.name}`);
      return Promise.resolve(null);
    }
    return Promise.resolve(this._insert({
      requestBody: this.cistGroupToInsertGoogleGroup(cistGroupData),
    })).tap(() =>  this._logger.info(`Inserted group ${cistGroupData.group.name}`));
  }

  private doDeleteByIds(
    groups: ReadonlyArray<Schema$Group>,
    ids: ReadonlySet<string>,
  ) {
    const promises = [];
    for (const group of groups) {
      // tslint:disable-next-line:no-non-null-assertion
      if (ids.has(group.id!)) {
        // tslint:disable-next-line:no-non-null-assertion
        promises.push(this.doDeleteById(group.email!));
      }
    }
    return Promise.all(promises);
  }

  private doDeleteById(groupEmailOrId: string) {
    return this._delete({
      groupKey: groupEmailOrId,
    });
  }

  private cistGroupToInsertGoogleGroup(
    cistGroupData: ICistGroupData,
    email = this._utils.getGroupEmail(cistGroupData.group),
  ): Schema$Group {
    return {
      email, // TODO: integrate with existing if any
      name: cistGroupData.group.name,
      description: getDescription(cistGroupData),
    };
  }

  private cistGroupToGoogleGroupPatch(
    cistGroupData: ICistGroupData,
    googleGroup: DeepReadonly<Schema$Group>,
  ) {
    let hasChanges = false;
    const groupPatch = {} as Schema$Group;
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
}

function getDescription(cistGroupData: ICistGroupData) {
  let description = `${cistGroupData.group.name}, faculty "${cistGroupData.faculty.full_name}" (${cistGroupData.faculty.short_name}), direction "${cistGroupData.direction.full_name}" (${cistGroupData.direction.short_name})`;
  if (cistGroupData.speciality) {
    description += `, speciality "${cistGroupData.speciality.full_name}" (${cistGroupData.speciality.short_name})`;
  }
  return description;
}
