import { Global, Logger, Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { TerminusModule } from "@nestjs/terminus";
import Redis from "ioredis";
import { REDIS_CLIENT } from "./redis.constants";
import { RedisHealthIndicator } from "./redis-health.indicator";

const logger = new Logger("RedisModule");

// P1-E3-F1-T1 — Redis didn't exist anywhere in the stack; this makes a
// configured client available app-wide (via @Inject(REDIS_CLIENT)) and
// health-checked. Deliberately not used for anything yet — caching, the
// BullMQ job queue, and WebSocket pub/sub are Phase 2 work that will consume
// this same client/module rather than each reinventing their own connection.
//
// P0-E3-F3-T5 — TerminusModule is required here (not just in HealthModule):
// RedisHealthIndicator depends on terminus's HealthIndicatorService, and
// @Global() only affects EXPORT visibility to other modules, not a module's
// own ability to resolve its own providers' dependencies. Without this
// import the app fails to boot at all with an unresolved-dependency error —
// confirmed live: this was broken until this fix, undetected until now
// because nothing had actually booted the compiled app since Redis/health
// were wired together.
@Global()
@Module({
  imports: [ConfigModule, TerminusModule],
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
