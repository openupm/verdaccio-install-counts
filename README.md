# verdaccio-install-counts

<!-- vscode-markdown-toc -->
* [Introduction](#Introduction)
* [Install](#Install)
* [API endpoints](#APIendpoints)
    * [Point values](#Pointvalues)
        * [Parameters](#Parameters)
        * [Output](#Output)
    * [Ranges](#Ranges)
        * [Parameters](#Parameters-1)
        * [Output](#Output-1)
* [Redis data structure](#Redisdatastructure)
    * [Timeseries](#Timeseries)
    * [Hashes](#Hashes)
    * [Sorted sets](#Sortedsets)
* [Cron](#Cron)

<!-- vscode-markdown-toc-config
    numbering=false
    autoSave=true
    /vscode-markdown-toc-config -->
<!-- /vscode-markdown-toc -->

## <a name='Introduction'></a>Introduction

This package implements API endpoints for package download counts similar to [the ones](https://raw.githubusercontent.com/npm/registry/master/docs/install-counts.md) provided by npm, but limited to a specific package.

The stats data is stored in Redis, using [RedisTimeSeries](https://redis.io/docs/stack/timeseries/). Please refer to the [Redis data structure](#redis-data-structure) section for more information.

Note that this package does not include a widget for the Verdaccio web UI.

## <a name='Install'></a>Install

Install the package.
```
npm install verdaccio-install-counts
```

Update the `middlewares` seciton of verdaccio's `config.yaml`.
```
middlewares:
  install-counts:
    enabled: true
    redis:
      host: 127.0.0.1
      port: 6379
      password: ...
```

## <a name='APIendpoints'></a>API endpoints

### <a name='Pointvalues'></a>Point values

Gets the total downloads for a given period for a specific package.

```
GET https://127.0.0.1:4873/downloads/point/{period}/{package}
```

#### <a name='Parameters'></a>Parameters

Acceptable values for `period` for a specific package. The timezone is GMT.

<dl>
    <dt>all-time</dt>
    <dd>Gets total downloads.</dd>
    <dt>last-day</dt>
    <dd>Gets downloads for the last available day.</dd>
    <dt>last-week</dt>
    <dd>Gets downloads for the last 7 available days.</dd>
    <dt>last-month</dt>
    <dd>Gets downloads for the last 30 available days.</dd>
    <dt>{start_date}:{end_date}</dt>
    <dd>Gets downloads for a given date range. The date format is yyyy-mm-dd.</dd>
</dl>

#### <a name='Output'></a>Output

JSON output:

```javascript
{
  "downloads": 16230,
  "start": "2023-01-01",
  "end": "2023-01-31",
  "package": "com.example.package"
}
```

### <a name='Ranges'></a>Ranges

Gets the downloads per day for a given period for a specific package.

```
GET https://127.0.0.1:4873/downloads/range/{period}/{package}
```

#### <a name='Parameters-1'></a>Parameters

Same as for `/downloads/point`.

#### <a name='Output-1'></a>Output

Responses are very similar to the point API, except that downloads is now an array of days with downloads on each day:

```javascript
{
    "downloads": [
        {
            "day": "2023-01-01",
            "downloads": 540
        },
        ..
        {
            "day": "2023-01-31",
            "downloads": 425
        }
    ],
    "start": "2023-01-01",
    "end": "2023-01-31",
    "package": "com.example.package"
}
```

## <a name='Redisdatastructure'></a>Redis data structure

The stats data is stored in Redis using timeseries, hashes or sorted sets.

### <a name='Timeseries'></a>Timeseries

Timeseries for daily download counts for a specific package.
```
tspkghit:daily:<package_name> <timestamp_utc> <count> LABELS category tspkghit:daily pkgname <package_name>
```

### <a name='Hashes'></a>Hashes

Hash for download counts for a specific package breakdown by versions.
```
pkghit:ver:<package_name> <version> <count>
```

### <a name='Sortedsets'></a>Sorted sets

Sorted set for all-time download counts.
```
zpkghit:alltime <count> <package_name>
```

Sorted set for the last 30 days' download counts.
```
zpkghit:lastmonth <count> <package_name> 
```

## <a name='Cron'></a>Cron

The `zpkghit:lastmonth` sorted set requries a cron job:
```bash
VERDACCIO_CONFIG=config.yaml npm run update-lastmonth
```
