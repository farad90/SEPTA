import { Inject, Injectable } from "@nestjs/common";
import { HealthIndicatorResult, HealthIndicatorService } from "@nestjs/terminus";
import type Redis from "ioredis";
import { REDIS_CLIENT } from "./redis.constants";

// terminus ships built-in indicators for Postgres/Mongo/TypeORM/etc. but not
// Redis — this follows the same functional pattern as its own indicators
// (HealthIndicatorService.check(key).up()/.down()), just for ioredis instead.
@Injectable()
export class RedisHealthIndicator {
  constructor(
    private readonly healthIndicatorService: HealthIndicatorService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async pingCheck(key: string): Promise<HealthIndicatorResult> {
    const indicator = this.healthIndicatorService.check(key);
    try {
      await this.redis.ping();
      return indicator.up();
    } catch (err) {
      return indicator.down({ message: (err as Error).message });
    }
  }
}
