import { Controller, Get } from "@nestjs/common";
import { HealthCheck, HealthCheckService, PrismaHealthIndicator } from "@nestjs/terminus";
import { PrismaService } from "../prisma/prisma.service";
import { RedisHealthIndicator } from "../common/redis/redis-health.indicator";

// P1-E2-F1-T1 — no health-check endpoint existed anywhere; Docker's
// `restart: unless-stopped` policy can only recover a fully-dead process, not
// distinguish a hung event loop or a dead DB connection from a healthy API.
// Intentionally public (no JwtAuthGuard) — this is consumed by Docker
// healthchecks, uptime monitors, and load balancers, none of which carry a
// user session.
@Controller("health")
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly prismaIndicator: PrismaHealthIndicator,
    private readonly prisma: PrismaService,
    private readonly redisIndicator: RedisHealthIndicator,
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.prismaIndicator.pingCheck("database", this.prisma),
      // P1-E3-F1-T1 — Redis is now part of the stack, so it's part of "healthy".
      () => this.redisIndicator.pingCheck("redis"),
    ]);
  }
}
