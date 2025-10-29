# privatecalendar
[![Docker Build](https://github.com/ChicoState/privatecalendar/actions/workflows/docker-build.yml/badge.svg)](https://github.com/ChicoState/privatecalendar/actions/workflows/docker-build.yml)

A simple open source project for a Software Enginneering class

# Docker setup

First, build the container
```docker buildx build -t private-calendar .```

Then run for web
```docker run -it --rm -p 8081:8081 private-calendar:latest```
Or for andriod mobile phone
```docker run -it --rm -p 19000:19000 -p 19001:19001 private-calendar:latest --tunnel```

Both will take a minute or so to load
