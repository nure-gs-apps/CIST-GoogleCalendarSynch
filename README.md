list: https://console.cloud.google.com/apis/dashboard
add: https://console.cloud.google.com/apis/library
https://console.cloud.google.com/apis/api/admin.googleapis.com/overview
https://console.cloud.google.com/apis/api/calendar-json.googleapis.com/overview

Guide: https://support.google.com/a/answer/162106?hl=en

create service credentials in GCP
https://console.cloud.google.com/projectselector2/iam-admin/serviceaccounts

https://developers.google.com/admin-sdk/directory/v1/guides/delegation - multiple scopes no space
https://admin.google.com/dl.kture.kharkov.ua/AdminHome?chromeless=1#OGX:ManageOauthClients
scopes: https://www.googleapis.com/auth/admin.directory.resource.calendar,https://www.googleapis.com/auth/admin.directory.group,https://www.googleapis.com/auth/calendar,https://www.googleapis.com/auth/calendar.events
client id from enabled delegation in service account

TODO:
- move common code for sync and task-finish tasks
- process errors: https://developers.google.com/admin-sdk/directory/v1/limits
- handle backendError
- add path transformer https://www.npmjs.com/package/@zerollup/ts-transform-paths

FIX:
- group & room sync
- add room feature: is have power
