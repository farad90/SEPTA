import { PrismaService } from "../prisma/prisma.service";
import { PerformanceReviewCyclesService } from "./performance-review-cycles.service";

function buildPrisma() {
  return {
    performanceReviewCycle: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };
}

describe("PerformanceReviewCyclesService", () => {
  it("create: converts startDate/endDate to real Date objects before calling Prisma", async () => {
    const prisma = buildPrisma();
    prisma.performanceReviewCycle.create.mockResolvedValue({ id: "c1" });
    const service = new PerformanceReviewCyclesService(prisma as unknown as PrismaService);

    await service.create({ cycleName: "دوره تست", startDate: "2026-01-01", endDate: "2026-06-30" });

    const data = prisma.performanceReviewCycle.create.mock.calls[0][0].data;
    expect(data.startDate).toBeInstanceOf(Date);
    expect(data.endDate).toBeInstanceOf(Date);
    expect(data.cycleName).toBe("دوره تست");
  });
});
