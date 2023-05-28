import fs from 'fs';
import path from 'path';
import Redis from 'ioredis';
import yaml from 'js-yaml';

/**
 * Get the Verdaccio config path from the VERDACCIO_CONFIG environment variable
 * @returns Verdaccio config path
 */
export function getVerdaccioConfigPath(): string {
  const verdaccioConfigPath = process.env.VERDACCIO_CONFIG;
  if (verdaccioConfigPath && verdaccioConfigPath.trim() !== '') {
    return verdaccioConfigPath;
  } else {
    return path.join(process.cwd(), 'config.yaml');
  }
}

/**
 * Read the Verdaccio config file
 * @returns Verdaccio config object
 */
export function readVerdaccioConfig(): any {
  const verdaccioConfigPath = getVerdaccioConfigPath();
  if (!fs.existsSync(verdaccioConfigPath)) {
    throw new Error(`Verdaccio configuration file not found: ${verdaccioConfigPath}`);
  }
  const verdaccioConfigContent = fs.readFileSync(verdaccioConfigPath, 'utf8');
  const verdaccioConfig = yaml.load(verdaccioConfigContent);
  return verdaccioConfig;
}

/**
 * Create a Redis client
 * @returns Redis client instance
 */
export function createRedisClient(): Redis {
  const verdaccioConfig = readVerdaccioConfig();
  const middlewares = verdaccioConfig['middlewares']
  const downloadCounts = middlewares['install-counts'];
  let redisOptions = {};
  if ('redis' in downloadCounts)
    redisOptions = downloadCounts['redis'];
  const redisClient = new Redis(redisOptions);
  return redisClient;
}

