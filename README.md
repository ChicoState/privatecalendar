# privatecalendar
[![Docker Build](https://github.com/ChicoState/privatecalendar/actions/workflows/docker-build.yml/badge.svg)](https://github.com/ChicoState/privatecalendar/actions/workflows/docker-build.yml)

A simple open source project for a Software Enginneering class with the idea of creating a better calendar then what already exists on mobile phones. This entails: 
 - Avoiding capturing user data
 - Sync between all your calendars in 1 place.
 - Keeping track of any tasks that you input into the calendar.
 - Offline use regardless if a user sets up an account to sync calendars or not

## Docker setup & running

First, build the container
```docker buildx build -t private-calendar .```

Then run for web

```docker run -it --rm -p 8081:8081 private-calendar:latest --web```

Or for andriod mobile phone

```docker run -it --rm -p 19000:19000 -p 19001:19001 private-calendar:latest --tunnel```
