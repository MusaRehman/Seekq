import type { Pool } from "pg";
import type { Redis } from "ioredis";

export type Db = Pool;
export type RedisConn = Redis;

export type DbDeps = { db: Db };
export type RedisDeps = { redis: RedisConn };
export type AppDeps = DbDeps & RedisDeps;
