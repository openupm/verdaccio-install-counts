import _ from 'lodash';
import semver from 'semver';

import { IStorageManager, Logger, Package, Version } from "@verdaccio/types";
import Redis, { RedisOptions } from 'ioredis';

import { CustomConfig } from '../types';
import { InvalidDateRangeError } from './constants';

/**
 * Parse the package version from tarball filename
 * @param {String} name
 * @returns {String}
 */
export function parseVersionFromTarballFilename(name: string): string | void {
  // FIXME: we know the regex is valid, but we should improve this part as ts suggest
  // @ts-ignore
  const version = /.+-(\d.+)\.tgz/.test(name) ? name.match(/.+-(\d.+)\.tgz/)[1] : undefined;
  if (version && semver.valid(version)) return version;
}

/**
 * Parse the package name from tarball filename
 * @param name tarball filname
 * @returns package name
 */
export function parsePackageNameFromTarball(name: string): string | void {
  const version = parseVersionFromTarballFilename(name);
  if (version) return name.split(`-${version}`)[0];
}

/**
 * Get version from a package object taking into account semver weirdness.
 * @return {String} return the semantic version of a package
 */
export function getVersion(pkg: Package, version: any): Version | void {
  // this condition must allow cast
  if (_.isNil(pkg.versions[version]) === false) {
    return pkg.versions[version];
  }

  try {
    version = semver.parse(version, true);
    for (const versionItem in pkg.versions) {
      // $FlowFixMe
      if (version.compare(semver.parse(versionItem, true)) === 0) {
        return pkg.versions[versionItem];
      }
    }
  } catch (err) {
    return undefined;
  }
}

/**
 * Create a Redis client
 * @param config string | RedisOptions
 * @param logger Logger object
 * @returns Redis client
 */
export function redisCreateClient(config: string | RedisOptions, logger: Logger): Redis {
  const client = new Redis(config as any);
  client.on('connect', function () {
    logger.warn('[install-counts] connected to redis server');
  });

  client.on("ready", function () {
    logger.warn("[install-counts] ready to use");
    logger.warn("[install-counts] set enableOfflineQueue to false to make following web requests fail instantly when redis connection is down");
    client.options.enableOfflineQueue = false;
  });

  client.on('reconnecting', function (delay) {
    logger.warn({ delay }, '[install-counts] reconnecting in @{delay}ms');
  });

  client.on('end', function () {
    logger.warn('[install-counts] redis connection end');
  });

  client.on('close', function () {
    logger.warn('[install-counts] redis connection close');
  });

  client.on('error', function (err) {
    logger.error({ err }, '[install-counts] redis error @{err}');
  });

  return client;
}

/**
 * Returns the epoch time in milliseconds for the given date at midnight.
 * @param date The date object for which to get the epoch time at midnight.
 * @returns The epoch time in milliseconds for the given date at midnight.
 */
export function getEpochTimeForUTCMidnight(date: Date): number {
  // Create a new date object with the same date as the input parameter
  const newDate = new Date(date.getTime());

  // Set the time to 00:00AM
  newDate.setUTCHours(0, 0, 0, 0);

  // Get the number of milliseconds since the epoch
  return newDate.getTime();
}

/**
 * Shift the given date to UTC midnight (00:00:00)
 * @param date Date object to shift
 * @returns New Date object shifted to UTC midnight
 */
export function shiftToUTCMidnight(date: Date): Date {
  const newDate = new Date(date);
  newDate.setUTCHours(0, 0, 0, 0);
  return newDate;
}

/**
 * Shift the given date to UTC midnight minus one millisecond (23:59:59.999)
 * @param date Date object to shift
 * @returns New Date object shifted to UTC midnight minus one millisecond
 */
export function shiftToUTCMidnightMinusOneMillisecond(date: Date): Date {
  let newDate = shiftToUTCMidnight(date);
  newDate.setUTCMilliseconds(-1);
  return newDate;
}

/**
 * Parse the given UTC date string in the format yyyy-mm-dd and return a Date object.
 * @param dateStr UTC date string in the format yyyy-mm-dd
 * @returns Date object
 */
export function parseUTCDateString(dateStr: string): Date {
  try {
    let [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    return date;
  }
  catch (err) {
    return new Date('invalid date');
  }
}

/**
 * Return [week_start_date, week_end_date] for the given date
 */
export function getWeekRange(date) {
  const weekStart = new Date(date);
  weekStart.setDate(date.getDate() - (date.getDay() + 6) % 7); // Set to the start of the week (Monday)
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6); // Set to the end of the week (Sunday)
  return [weekStart, weekEnd];
}

/**
 * The async version of storage.getPackage(options)
 * @param storage storage manager
 * @param options options of storage.getPackage(options)
 * @returns Promise<Package> 
 */
export function getPackageAsync(storage: IStorageManager<CustomConfig>, options: any): Promise<Package> {
  return new Promise((resolve, reject) => {
    storage.getPackage({
      ...options,
      callback: (err: any, metadata: Package) => {
        if (err) {
          reject(err);
        } else {
          resolve(metadata);
        }
      }
    });
  });
}

/**
 * Parse the period string into a start and end date
 * @param period string value of "all-time", "last-day", "last-week", "last-month", or a date range in the format of YYYY-MM-DD:YYYY-MM-DD
 * @returns Array [startDate, endDate]
 */
export function parsePeriod(period: string): Array<Date> {
  let startDate: Date;
  let endDate: Date;
  const now = new Date();
  let shiftUTC = true;
  switch (period) {
    case 'all-time':
      startDate = new Date(0);
      endDate = new Date(now);
      break;
    case 'last-day':
      startDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
      endDate = new Date(now);
      break;
    case 'last-week':
      startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      endDate = new Date(now);
      break;
    case 'last-month':
      startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      endDate = new Date(now);
      break;
    default:
      const [startStr, endStr] = period.split(':');
      startDate = parseUTCDateString(startStr);
      endDate = parseUTCDateString(endStr);
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime()))
        throw new InvalidDateRangeError();
      // The date range is already in UTC, no need to shift
      shiftUTC = false;
      break;
  }
  // Make sure that endDate is not in the future
  if (endDate > now)
    endDate = new Date(now);
  if (shiftUTC) {
    // Align the start date to UTC midnight (00:00:00)
    startDate.setUTCHours(0, 0, 0, 0);
    // Align the end date to UTC midnight minus 1 milliseconds (59:59:59:999)
    endDate.setUTCHours(0, 0, 0, 0);
    // Shift the end date by 1 millisecond to exclude the end date 00:00:00 from the query
    endDate.setUTCMilliseconds(-1);
  }
  // Make sure that startDate is before endDate
  if (startDate > endDate)
    endDate = startDate;
  // self.logger.debug(`[install-counts] startDate: ${startDate.toISOString()}`);
  // self.logger.debug(`[install-counts] endDate: ${endDate.toISOString()}`);
  return [startDate, endDate];
}

/**
 * Update the Redis database with the given package download event
 * @param redisClient redis client
 * @param packageName package name
 * @param version package version
 * @param date date of the download event
 * @param logger optional logger
 * @returns results of the Redis pipeline
 */
export async function updateRedisOnPackageDownload(redisClient: Redis, packageName: string, version: string, date: Date, logger?: any): Promise<any> {
  const utcMidnightEpoch = getEpochTimeForUTCMidnight(date);
  // Save the event to Redis
  const results = await redisClient.pipeline()
    // TS.ADD tspkghit:daily:<package_name> <date> 1 ON_DUPLICATE sum LABELS category tspkghit:daily pkgname <package_name>
    .call('TS.ADD', `tspkghit:daily:${packageName}`, utcMidnightEpoch, 1, 'ON_DUPLICATE', 'sum', 'LABELS', 'category', 'tspkghit:daily', 'pkgname', packageName)
    // HINCRBY pkghit:ver:<package_name> <version> 1
    .hincrby(`pkghit:ver:${packageName}`, version, 1)
    // ZINCRBY zpkghit:alltime 1 <package_name>
    .zincrby('zpkghit:alltime', 1, packageName)
    .exec();
  if (results != null) {
    var obj = results[0][0];
    if (obj != null && obj instanceof Error) {
      if (logger) logger.error(obj);
      else console.error(obj);
    }
  }
  return results;
}

/**
 * Get Redis TimeSeries results for a given period for a specific package
 * @param startDate start date
 * @param endDate end date
 * @param packageName name of the package
 * @returns query array (Array<[string, string]> | null) with time bucket of 1 day
 */
export async function getPackageDownloadTimeSeriesResults(redisClient: Redis, startDate: Date, endDate: Date, packageName: String): Promise<Array<[string, string]> | null> {
  try {
    // Get the total downloads for the package in the period
    const results = await redisClient.call(
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
  } catch (err) {
    if ((err! as Error).message !== "ERR TSDB: the key does not exist")
      console.error(err);
    return null;
  }
}

function minDate(a: Date, b: Date): Date {
  return a < b ? a : b;
}

function maxDate(a: Date, b: Date): Date {
  return a > b ? a : b;
}

/**
 * Fill in missing dates in a list of discrete stats objects with a downloads value of 0
 * @param discreteStats List of discrete stats objects with a format of { "day": "yyyy-mm-dd", "downloads": <number> }
 * @param startDate optional start date
 * @param endDate optional end date
 * @returns List of discrete stats objects with the missing dates filled in with a downloads value of 0
 */
export function fillMissingDates(discreteStats: { day: string; downloads: number }[], startDate?: Date, endDate?: Date): { day: string; downloads: number }[] {
  if (discreteStats.length === 0) return [];
  const filledStats: { day: string; downloads: number }[] = [];
  if (startDate === undefined)
    startDate = new Date(discreteStats[0].day);
  else
    startDate = minDate(startDate, new Date(discreteStats[0].day));
  if (endDate === undefined)
    endDate = new Date(discreteStats[discreteStats.length - 1].day);
  else
    endDate = maxDate(endDate, new Date(discreteStats[discreteStats.length - 1].day));
  let currentDate = startDate;
  let currentIndex = 0;
  while (currentDate <= endDate) {
    const currentDay = currentDate.toISOString().substring(0, 10);
    if (currentIndex < discreteStats.length && discreteStats[currentIndex].day === currentDay) {
      filledStats.push(discreteStats[currentIndex]);
      currentIndex++;
    } else {
      filledStats.push({ day: currentDay, downloads: 0 });
    }
    currentDate.setDate(currentDate.getDate() + 1);
  }
  return filledStats;
}
