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
- add path transformer https://www.npmjs.com/package/@zerollup/ts-transform-paths
- `FIXME:` and `TODO:` in code
- create group hierarchy:
    - check if has `+`
    - split by `+` and transform each to upper case
    - check with other groups in upper case
- ensure autoInject & Symbols return the same instance
- resource id/email parsing & check for prefixes

FIX:
- unknown insert error, maybe only with -age flags e.g. {"email":"g_knpz-19-1_8468183@dl.kture.kharkov.ua","name":"КНпз-19-1","description":"КНпз-19-1, faculty \\"ЦПО\\" (Центр післядипломної освіти), direction \\"КН\\" (Комп`ютерні науки), speciality \\"ПЗАСп\\" (ПЗАСп)"}
