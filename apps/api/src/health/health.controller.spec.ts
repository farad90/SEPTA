import { HealthCheckService, PrismaHealthIndicator } from "@nestjs/terminus";
import { HealthController } from "./health.controller";
import { PrismaService } from "../prisma/prisma.service";
import { RedisHealthIndicator } from "../common/redis/redis-health.indicator";

describe("HealthController", () => {
  let healthCheckService: { check: jest.Mock };
  let prismaIndicator: { pingCheck: jest.Mock };
  let redisIndicator: { pingCheck: jest.Mock };
  let controller: HealthController;

  beforeEach(() => {
    healthCheckService = { check: jest.fn() };
    prismaIndicator = { pingCheck: jest.fn() };
    redisIndicator = { pingCheck: jest.fn() };
    controller = new HealthController(
      healthCheckService as unknown as HealthCheckService,
      prismaIndicator as unknown as PrismaHealthIndicator,
      {} as unknown as PrismaService,
      redisIndicator as unknown as RedisHealthIndicator,
    );
  });

  it("reports healthy when both the database and Redis pings succeed", async () => {
    healthCheckService.check.mockImplementation(async (indicators: Array<() => unknown>) => {
      const results = await Promise.all(indicators.map((fn) => fn()));
      return { status: "ok", info: Object.assign({}, ...results), error: {}, details: Object.assign({}, ...results) };
    });
    prismaIndicator.pingCheck.mockResolvedValue({ database: { status: "up" } });
    redisIndicator.pingCheck.mockResolvedValue({ redis: { status: "up" } });

    const result = await controller.check();

    expect(result.status).toBe("ok");
    expect(prismaIndicator.pingCheck).toHaveBeenCalledWith("database", expect.anything());
    expect(redisIndicator.pingCheck).toHaveBeenCalledWith("redis");
  });

  it("surfaces a non-ok status when the database ping fails", async () => {
    healthCheckService.check.mockImplementation(async (indicators: Array<() => unknown>) => {
      try {
        await Promise.all(indicators.map((fn) => fn()));
        return { status: "ok", info: {}, error: {}, details: {} };
      } catch {
        return {
          status: "error",
          info: {},
          error: { database: { status: "down" } },
          details: { database: { status: "down" } },
        };
      }
    });
    prismaIndicator.pingCheck.mockRejectedValue(new Error("connection refused"));
    redisIndicator.pingCheck.mockResolvedValue({ redis: { status: "up" } });

    const result = await controller.check();

    expect(result.status).toBe("error");
    expect(result.error).toEqual({ database: { status: "down" } });
  });

  it("surfaces a non-ok status when the Redis ping fails, even if the database is healthy", async () => {
    healthCheckService.check.mockImplementation(async (indicators: Array<() => unknown>) => {
      try {
        await Promise.all(indicators.map((fn) => fn()));
        return { status: "ok", info: {}, error: {}, details: {} };
      } catch {
        return {
          status: "error",
          info: {},
          error: { redis: { status: "down" } },
          details: { redis: { status: "down" } },
        };
      }
    });
    prismaIndicator.pingCheck.mockResolvedValue({ database: { status: "up" } });
    redisIndicator.pingCheck.mockRejectedValue(new Error("connection refused"));

    const result = await controller.check();

    expect(result.status).toBe("error");
    expect(result.error).toEqual({ redis: { status: "down" } });
  });
});
