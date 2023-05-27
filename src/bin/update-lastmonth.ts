import { getPackageDownloadTimeSeriesResults, shiftToUTCMidnight } from '../utils';
import { createRedisClient } from './cli-utils';

/**
 * Get the unique package names from the time series data
 * @param redisClient - Redis client instance
 * @returns package names
 */
async function getUniquePackageNames(redisClient): Promise<string[]> {
  // Scan all keys with the pattern tspkghit:daily:<package>
  const results = await redisClient.call('TS.QUERYINDEX', 'category=tspkghit:daily') as string[];
  // Extract the package names from results
  const packageNames = new Set<string>();
  for (const key of results) {
    const packageName = key.split(':')[2];
    packageNames.add(packageName);
  }
  // Convert the set to an sorted array and return it
  return Array.from(packageNames).sort();
}

/**
 * Update the zpkghit:lastmonth key with the total downloads for the last month
 * @param redisClient - Redis client instance
 */
async function updateLastMonth(redisClient) {
  // Connect to Redis
  const packages = await getUniquePackageNames(redisClient);
  const endDate = shiftToUTCMidnight(new Date());
  const startDate = shiftToUTCMidnight(new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000)); // 30 days ago
  console.log(`startDate: ${startDate}`);
  console.log(`endDate: ${endDate}`);

  // Iterate over all packages
  for (const packageName of packages) {
    // Query the time series data for the package
    const results = await getPackageDownloadTimeSeriesResults(redisClient, startDate, endDate, packageName);
    // Calculate the total downloads for the last month
    let totalDownloads = 0;
    if (results !== null) {
      for (const [timestamp, count] of results) {
        totalDownloads += Number(count);
      }
    }
    // Update the zpkghit:lastmonth key with the total downloads
    await redisClient.zadd('zpkghit:lastmonth', totalDownloads, packageName);
  }
  console.log(`Updated zpkghit:lastmonth with ${packages.length} packages`);
}

async function main() {
  const redisClient = createRedisClient();
  await updateLastMonth(redisClient);
}

if (require.main === module) {
  main().then(() => {
    process.exit(0);
  }).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
