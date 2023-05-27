# Importing Logs

These internal scripts are used to import nginx access logs into download count statistics.

## Parsing Logs into event.csv

Assuming the nginx logs are located at `/var/log/nginx/verdaccio.log*`, execute the following command:

```bash
sudo import-logs/parselog.sh > event.csv
```

Alternatively, you can manually prepare the `event.csv` file in a similar format as the `example.csv` file.

## Importing into Redis

```bash
# export REDIS_HOST=localhost
# export REDIS_PORT=6379
# export REDIS_PASSWORD=...

# The script will delete existing Redis keys for download counts.
ALLOW_RESET_REDIS=1 import-logs/reset-redis.sh

# Import the event.csv file into Redis.
cat ~/event.csv | npm run import-csv

# Update last-month statistics.
VERDACCIO_CONFIG=PATH_TO_VERDACCIO_CONFIG npm run update-lastmonth
```
