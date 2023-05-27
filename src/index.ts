import _ from 'lodash';
import Redis from "ioredis";

import { Logger, IPluginMiddleware, IBasicAuth, IStorageManager, Package, PluginOptions } from '@verdaccio/types';
import { getPackageAsync, parsePackageNameFromTarball, getVersion, parseVersionFromTarballFilename, parsePeriod, redisCreateClient, updateRedisOnPackageDownload, getPackageDownloadTimeSeriesResults } from './utils';
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
      let queryVersion = parseVersionFromTarballFilename(fileName);
      let parsedPackageName = parsePackageNameFromTarball(fileName);
      try {
        const metadata = await getPackageAsync(_storage, {
          name: packageName,
          uplinksLook: true,
          req,
          abbreviated: false
        });
        let version = getVersion(metadata, queryVersion);
        if (_.isNil(version) === false && parsedPackageName === packageName) {
          // Update download counts for the package
          await updateRedisOnPackageDownload(self.redisClient, packageName, version!.version, new Date(), self.logger);
        }
        // Always call next() to continue processing the request, even if there is an error updating the download counts
        next();
      } catch (err) {
        next(err);
      }
    });

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
        const results = await getPackageDownloadTimeSeriesResults(self.redisClient, startDate, endDate, packageName);
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
        // this.logger.debug(`[download-counts] startDate: ${startDate.toISOString()}, endDate: ${endDate.toISOString()}`);
        const metadata = await getPackageAsync(_storage, {
          name: packageName,
          uplinksLook: true,
          req,
          abbreviated: false
        });
        // this.logger.debug(`[download-counts] metadata: ${JSON.stringify(metadata)}`);
        const results = await getPackageDownloadTimeSeriesResults(self.redisClient, startDate, endDate, packageName);
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
