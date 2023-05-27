#!/bin/bash

# Check if ALLOW_RESET_REDIS environment variable exists
if [[ "${ALLOW_RESET_REDIS}" != "1" ]]; then
    echo "ALLOW_RESET_REDIS is not set to 1"
    exit 1
fi

# Build the redis-cli parameters
redis_params=""

# Check if REDIS_HOST environment variable exists
if [[ -n "${REDIS_HOST}" ]]; then
    redis_params+=" --host ${REDIS_HOST}"
fi

# Check if REDIS_PORT environment variable exists
if [[ -n "${REDIS_PORT}" ]]; then
    redis_params+=" --port ${REDIS_PORT}"
fi

# Check if REDIS_PASSWORD environment variable exists
if [[ -n "${REDIS_PASSWORD}" ]]; then
    redis_params+=" -a ${REDIS_PASSWORD}"
fi

echo "Redis parameters: ${redis_params}"

echo "TS.QUERYINDEX category=tspkghit:daily" | redis-cli ${redis_params} | cut -d" " -f2 | sed 's/^/DEL /' | redis-cli
echo "DEL zpkghit:alltime" | redis-cli
echo "DEL zpkghit:lastmonth" | redis-cli
echo "SCAN 0 MATCH pkghit:ver:* COUNT 1000000" | redis-cli ${redis_params} | cut -d" " -f2 | sed 's/^/DEL /' | redis-cli
