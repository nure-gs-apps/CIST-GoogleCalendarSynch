import { admin_directory_v1 } from 'googleapis';
import { inject, injectable } from 'inversify';
import { TYPES } from '../../di/types';
import { ApiGroupResponse } from '../cist-json-client.service';
import { customer } from './constants';
import { GoogleApiDirectory } from './google-api-directory';
import Schema$Group = admin_directory_v1.Schema$Group;

@injectable()
export class GroupsService {
  static readonly ROOMS_PAGE_SIZE = 1000;
  private readonly _admin: GoogleApiDirectory;
  private readonly _groups: admin_directory_v1.Resource$Groups;

  constructor(@inject(TYPES.GoogleApiAdmin) googleAdmin: GoogleApiDirectory) {
    this._admin = googleAdmin;
    this._groups = this._admin.googleAdmin.groups;
  }

  async ensureGroups(cistResponse: ApiGroupResponse) {

  }

  private async loadGroups() {
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
    return groups;
  }
}
