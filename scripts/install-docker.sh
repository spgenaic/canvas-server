#!/bin/bash

docker-compose build --force-rm --no-cache --pull
docker-compose up --detach
