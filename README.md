export GOOGLE_APPLICATION_CREDENTIALS=`realpath $(pwd)/../cist-calendar.json`

create service credentials in GCP
https://developers.google.com/admin-sdk/directory/v1/guides/delegation - multiple scopes no space

CLARIFY:
- whether use or not cache in services

TODO:
- process errors: https://developers.google.com/admin-sdk/directory/v1/limits
- handle backendError
