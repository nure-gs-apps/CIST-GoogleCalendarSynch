For iconv: sudo apt-get install build-essential

export GOOGLE_APPLICATION_CREDENTIALS=`realpath $(pwd)/../cist-calendar.json`

create service credentials in GCP
https://developers.google.com/admin-sdk/directory/v1/guides/delegation

TODO:
- add timeout in 100 seconds
- add change detection
