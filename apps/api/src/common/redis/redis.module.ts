import { Global, Logger, Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import Redis from "ioredis";
import { REDIS_CLIENT } from "./redis.constants";
import { RedisHealthIndicator } from "./redis-health.indicator";

const logger = new Logger("RedisModule");

// P1-E3-F1-T1 — Redis didn't exist anywhere in the stack; this makes a
// configured client available app-wide (via @Inject(REDIS_CLIENT)) and
// health-checked. Deliberately not used for anything yet — caching, the
// BullMQ job queue, and WebSocket pub/sub are Phase 2 work that will consume
// this same client/module rather than each reinventing their own connection.
@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const client = new Redis(config.get<string>("REDIS_URL")!, {
          maxRetriesPerRequest: 3,
          lazyConnect: false,
        });
        // ioredis is an EventEmitter — an unhandled 'error' event (e.g. Redis
        // temporarily unreachable) would otherwise throw and crash the whole
        // API process. The health check is what's supposed to surface "Redis
        // is down"; a background connection hiccup shouldn't take the app
        // with it.
        client.on("error", (err) => logger.error(`Redis connection error: ${err.message}`));
        return client;
      },
    },
    RedisHealthIndicator,
  ],
  exports: [REDIS_CLIENT, RedisHealthIndicator],
})
export class RedisModule {}
