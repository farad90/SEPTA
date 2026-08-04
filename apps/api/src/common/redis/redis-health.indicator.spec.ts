import { HealthIndicatorService } from "@nestjs/terminus";
import type Redis from "ioredis";
import { RedisHealthIndicator } from "./redis-health.indicator";

describe("RedisHealthIndicator", () => {
  let healthIndicatorService: { check: jest.Mock };
  let session: { up: jest.Mock; down: jest.Mock };
  let redis: { ping: jest.Mock };
  let indicator: RedisHealthIndicator;

  beforeEach(() => {
    session = { up: jest.fn().mockReturnValue({ redis: { status: "up" } }), down: jest.fn().mockReturnValue({ redis: { status: "down" } }) };
    healthIndicatorService = { check: jest.fn().mockReturnValue(session) };
    redis = { ping: jest.fn() };
    indicator = new RedisHealthIndicator(
      healthIndicatorService as unknown as HealthIndicatorService,
      redis as unknown as Redis,
    );
  });

  it("reports up when Redis responds to PING", async () => {
    redis.ping.mockResolvedValue("PONG");

    const result = await indicator.pingCheck("redis");

    expect(healthIndicatorService.check).toHaveBeenCalledWith("redis");
    expect(session.up).toHaveBeenCalled();
    expect(result).toEqual({ redis: { status: "up" } });
  });

  it("reports down with the error message when Redis is unreachable", async () => {
    redis.ping.mockRejectedValue(new Error("connect ECONNREFUSED"));

    const result = await indicator.pingCheck("redis");

    expect(session.down).toHaveBeenCalledWith({ message: "connect ECONNREFUSED" });
    expect(result).toEqual({ redis: { status: "down" } });
  });
});
