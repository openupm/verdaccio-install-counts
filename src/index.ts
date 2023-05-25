import _ from 'lodash';
import Redis from "ioredis";

import { Logger, IPluginMiddleware, IBasicAuth, IStorageManager, Package, PluginOptions } from '@verdaccio/types';
import { getEpochTimeForUTCMidnight, getPackageAsync, getPackageNameFromTarball, getVersion, getVersionFromTarball, parsePeriod, redisCreateClient } from './utils';
import { Application } from 'express';

import { CustomConfig } from '../types/index';

export default class VerdaccioMiddlewarePlugin implements IPluginMiddleware<CustomConfig> {
  public logger: Logger;
  public redisClient: Redis;

  public constructor(config: CustomConfig, options: PluginOptions<CustomConfig>, redisClient?: Redis) {
    this.logger = options.logger;
    if (redisClient !== undefined)
      this.redisClient = redisClient;
    else
      this.redisClient = redisCreateClient(config.redis || {}, this.logger);
  }

  public register_middlewares(
    app: Application,
    auth: IBasicAuth<CustomConfig>,
    _storage: IStorageManager<CustomConfig>,
  ): void {
    // Define the middleware to insert before the download endpoint
    app.use('/:package/-/:filename', async (req, res, next) => {
      if (req.method === 'HEAD') {
        next();
        return;
      }
      const self = this;
      const packageName = req.params.package;
      const fileName = req.params.filename;
      let queryVersion = getVersionFromTarball(fileName) || undefined;
      let parsedPackageName = getPackageNameFromTarball(fileName);
      try {
        const metadata = await getPackageAsync(_storage, {
          name: packageName,
          uplinksLook: true,
          req,
          abbreviated: false
        });
        let version = getVersion(metadata, queryVersion);
        if (_.isNil(version) === false && parsedPackageName === packageName) {
          // this.logger.debug('[download-counts] packageName: ' + packageName);
          // this.logger.debug('[download-counts] version: ' + version!.version);
          // Update download counts for the package
          const date = new Date();
          // Align the date to UTC midnight (00:00:00)
          const utcMidnightEpoch = getEpochTimeForUTCMidnight(date);
          try {
            await self.redisClient.pipeline()
              // TS.INCRBY tspkghit:daily:<package_name> 1 TIMESTAMP <date> LABELS category tspkghit:daily
              .call('TS.INCRBY', `tspkghit:daily:${packageName}`, 1, 'TIMESTAMP', utcMidnightEpoch, 'LABELS', 'category', 'tspkghit:daily')
              // HINCRBY pkghit:ver:<package_name> <version> 1
              .hincrby(`pkghit:ver:${packageName}`, version!.version, 1)
              // ZINCRBY zpkghit:alltime 1 <package_name>
              .zincrby('zpkghit:alltime', 1, packageName)
              .exec();
          } catch (err) {
            self.logger.error(err);
          }
        }
        // Always call next() to continue processing the request, even if there is an error updating the download counts
        next();
      } catch (err) {
        next(err);
      }
    });

    /**
     * Helper function to get the Redis TimeSeries results for a given period for a specific package
     * @param startDate start date
     * @param endDate end date
     * @param packageName name of the package
     * @returns query array (Array<[string, string]> | null) with time bucket of 1 day
     */
    const getRedisTimeSeriesResults = async (startDate: Date, endDate: Date, packageName: String): Promise<Array<[string, string]> | null> => {
      // Get the total downloads for the package in the period
      const results = await this.redisClient.call(
        'TS.RANGE',
        `tspkghit:daily:${packageName}`,
        startDate.getTime().toString(),
        endDate.getTime().toString(),
        'AGGREGATION',
        'SUM',
        // The time bucket is 1 day
        '86400000'
      ) as Array<[string, string]> | null;
      return results;
    }

    // Endpoint to get total downloads for a given period for a specific package
    app.get('/downloads/point/:period/:package', async (req, res) => {
      const self = this;
      const { period, package: packageName } = req.params;
      try {
        const [startDate, endDate] = parsePeriod(period);
        // this.logger.debug(`[download-counts] startDate: ${startDate.toISOString()}, endDate: ${endDate.toISOString()}`);
        const metadata = await getPackageAsync(_storage, {
          name: packageName,
          uplinksLook: true,
          req,
          abbreviated: false
        });
        // this.logger.debug(`[download-counts] metadata: ${JSON.stringify(metadata)}`);
        const results = await getRedisTimeSeriesResults(startDate, endDate, packageName);
        let totalDownloads = 0;
        if (results !== null) {
          for (const [timestamp, count] of results) {
            totalDownloads += Number(count);
          }
        }
        // Return the total downloads for the package in the period
        const response = {
          downloads: totalDownloads,
          start: startDate.toISOString().substring(0, 10),
          end: endDate.toISOString().substring(0, 10),
          package: packageName,
        };
        res.json(response);
      } catch (err) {
        const error = err as any;
        if (error.code)
          res.status(error.code).json(error);
        else {
          self.logger.error(err);
          res.status(500).json({ code: 500, message: "Internal error" });
        }
      }
    });

    // Endpoint to get daily download counts for a given period for a specific package
    app.get('/downloads/range/:period/:package', async (req, res) => {
      const self = this;
      const { period, package: packageName } = req.params;
      try {
        const [startDate, endDate] = parsePeriod(period);
        this.logger.debug(`[download-counts] startDate: ${startDate.toISOString()}, endDate: ${endDate.toISOString()}`);
        const metadata = await getPackageAsync(_storage, {
          name: packageName,
          uplinksLook: true,
          req,
          abbreviated: false
        });
        // this.logger.debug(`[download-counts] metadata: ${JSON.stringify(metadata)}`);
        const results = await getRedisTimeSeriesResults(startDate, endDate, packageName);
        const downloads: { day: string; downloads: number }[] = [];
        if (results !== null) {
          const dateMap = new Map<string, number>();
          for (const [timestamp, count] of results) {
            const day = new Date(Number(timestamp)).toISOString().substring(0, 10);
            if (dateMap.has(day)) {
              dateMap.set(day, dateMap.get(day)! + Number(count));
            } else {
              dateMap.set(day, Number(count));
            }
          }
          for (const [day, count] of dateMap) {
            downloads.push({ day, downloads: count });
          }
        }
        // Return the daily download counts for the package in the period
        const response = {
          downloads,
          start: startDate.toISOString().substring(0, 10),
          end: endDate.toISOString().substring(0, 10),
          package: packageName,
        };
        res.json(response);
      } catch (err) {
        const error = err as any;
        if (error.code)
          res.status(error.code).json(error);
        else {
          self.logger.error(err);
          res.status(500).json({ code: 500, message: "Internal error" });
        }
      }
    });
  }
}
