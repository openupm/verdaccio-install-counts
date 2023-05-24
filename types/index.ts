import {Config} from '@verdaccio/types';
import { RedisOptions } from 'ioredis';

// See https://github.com/NodeRedis/node-redis#options-object-properties
// export interface CustomConfig extends Config, RedisOptions {}
export interface CustomConfig extends Config {
    redis: RedisOptions;
}

