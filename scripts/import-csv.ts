/**
 * This script imports data from stdin with the CSV format (tarballFilename, timestamp) to Redis.
 * See example.csv for an example.
 * Usage: cat example.csv | ts-node scripts/import-csv.ts
 */

import { env } from "process";
import readline from 'readline';
import Redis from "ioredis";
import { getEpochTimeForUTCMidnight, parsePackageNameFromTarball, parseVersionFromTarballFilename } from "../src/utils";

interface DownloadEvent {
  packageName: string;
  version: string;
  timestamp: Date;
}

/**
 * Create a Redis client
 * @returns Redis client instance
 */
function createRedisClient(redisOptions): Redis {
  const redisClient = new Redis(redisOptions);
  return redisClient;
}

/**
 * Parse a line of CSV format into a DownloadEvent object
 */
function parseDownloadEvent(line: string): DownloadEvent | null {
  let [tarballFilename, timestamp] = line.split(',');
  tarballFilename = tarballFilename.trim();
  timestamp = timestamp.trim();
  const packageName = parsePackageNameFromTarball(tarballFilename);
  const version = parseVersionFromTarballFilename(tarballFilename);
  const date = new Date(timestamp)
  if (packageName && version && timestamp && isNaN(date.getTime()) === false)
    return { packageName, version, timestamp: date };
  else {
    console.error(`Invalid line: ${line}`);
    return null;
  }
}

/**
 * Import data from stdin with the CSV format (tarballFilename, timestamp) to Redis
 * @param redisClient - Redis client instance
 */
async function importCSV(redisClient: Redis) {
  const rl = readline.createInterface({
    input: process.stdin,
    crlfDelay: Infinity,
  });
  for await (let line of rl) {
    line = line.trim();
    if (line === '') continue;
    const event = parseDownloadEvent(line);
    if (event) {
      const packageName = event.packageName;
      const version = event.version;
      const utcMidnightEpoch = getEpochTimeForUTCMidnight(event.timestamp);
      try {
        // Save the event to Redis
        await redisClient.pipeline()
          // TS.INCRBY tspkghit:daily:<package_name> 1 TIMESTAMP <date> LABELS category tspkghit:daily
          .call('TS.INCRBY', `tspkghit:daily:${packageName}`, 1, 'TIMESTAMP', utcMidnightEpoch, 'LABELS', 'category', 'tspkghit:daily')
          // HINCRBY pkghit:ver:<package_name> <version> 1
          .hincrby(`pkghit:ver:${packageName}`, version, 1)
          // ZINCRBY zpkghit:alltime 1 <package_name>
          .zincrby('zpkghit:alltime', 1, packageName)
          .exec();
      } catch (error) {
        console.error(error);
      }
    }
  }
}

async function main() {
  const redisOptions = {
    host: env.REDIS_HOST || 'localhost',
    port: parseInt(env.REDIS_PORT || "") || 6379,
    password: env.REDIS_PASSWORD || undefined,
  };
  const redisClient = createRedisClient(redisOptions);
  await importCSV(redisClient);
}

if (require.main === module) {
  main().then(() => {
    process.exit(0);
  }).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
