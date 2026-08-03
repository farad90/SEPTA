import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { HrAccessService } from "./hr-access.service";
import { PerformanceReviewsService } from "./performance-reviews.service";

function buildPrisma() {
  const prisma: any = {
    employee: { findFirst: jest.fn() },
    performanceReview: { findUnique: jest.fn(), update: jest.fn(), create: jest.fn() },
    performanceReviewItem: { update: jest.fn() },
  };
  prisma.$transaction = jest.fn((cb: (tx: unknown) => unknown) => cb(prisma));
  return prisma;
}

function buildService(prisma: ReturnType<typeof buildPrisma>) {
  const p = prisma as unknown as PrismaService;
  return new PerformanceReviewsService(p, new HrAccessService(p));
}

const REVIEW = {
  id: "review-1",
  employeeId: "emp-1",
  reviewerId: "reviewer-1",
  status: "draft",
  items: [{ id: "item-1" }],
};

describe("PerformanceReviewsService", () => {
  it("selfReview: rejects when the caller isn't the review's subject employee", async () => {
    const prisma = buildPrisma();
    prisma.performanceReview.findUnique.mockResolvedValue(REVIEW);
    prisma.employee.findFirst.mockResolvedValue({ id: "someone-else" });
    const service = buildService(prisma);

    await expect(service.selfReview("user-1", "review-1", { selfReviewNotes: "متن" })).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it("selfReview: rejects when the review is no longer draft", async () => {
    const prisma = buildPrisma();
    prisma.performanceReview.findUnique.mockResolvedValue({ ...REVIEW, status: "submitted" });
    prisma.employee.findFirst.mockResolvedValue({ id: "emp-1" });
    const service = buildService(prisma);

    await expect(service.selfReview("user-1", "review-1", { selfReviewNotes: "متن" })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it("selfReview: succeeds for the review's own subject employee", async () => {
    const prisma = buildPrisma();
    prisma.performanceReview.findUnique.mockResolvedValue(REVIEW);
    prisma.employee.findFirst.mockResolvedValue({ id: "emp-1" });
    prisma.performanceReview.update.mockResolvedValue({ id: "review-1" });
    const service = buildService(prisma);

    await service.selfReview("user-1", "review-1", { selfReviewNotes: "متن خودارزیابی" });
    expect(prisma.performanceReview.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { selfReviewNotes: "متن خودارزیابی" } }),
    );
  });

  it("submit: rejects when the caller isn't the assigned reviewer (e.g. is the direct manager but not the reviewer)", async () => {
    const prisma = buildPrisma();
    prisma.performanceReview.findUnique.mockResolvedValue(REVIEW);
    prisma.employee.findFirst.mockResolvedValue({ id: "some-manager" });
    const service = buildService(prisma);

    await expect(
      service.submit("user-1", "review-1", { items: [{ id: "item-1", score: 90 }] }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("submit: rejects an item id that doesn't belong to the review", async () => {
    const prisma = buildPrisma();
    prisma.performanceReview.findUnique.mockResolvedValue(REVIEW);
    prisma.employee.findFirst.mockResolvedValue({ id: "reviewer-1" });
    const service = buildService(prisma);

    await expect(
      service.submit("user-1", "review-1", { items: [{ id: "not-a-real-item", score: 90 }] }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("submit: succeeds for the assigned reviewer and marks the review submitted", async () => {
    const prisma = buildPrisma();
    prisma.performanceReview.findUnique.mockResolvedValue(REVIEW);
    prisma.employee.findFirst.mockResolvedValue({ id: "reviewer-1" });
    prisma.performanceReview.update.mockResolvedValue({ id: "review-1", status: "submitted" });
    const service = buildService(prisma);

    await service.submit("user-1", "review-1", { items: [{ id: "item-1", score: 90 }], overallScore: 88 });

    expect(prisma.performanceReviewItem.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "item-1" }, data: { score: 90, comments: undefined } }),
    );
    expect(prisma.performanceReview.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "submitted", overallScore: 88 }) }),
    );
  });

  it("acknowledge: rejects when the caller isn't the review's subject employee", async () => {
    const prisma = buildPrisma();
    prisma.performanceReview.findUnique.mockResolvedValue({ ...REVIEW, status: "submitted" });
    prisma.employee.findFirst.mockResolvedValue({ id: "someone-else" });
    const service = buildService(prisma);

    await expect(service.acknowledge("user-1", "review-1")).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("acknowledge: rejects when the review hasn't been submitted yet", async () => {
    const prisma = buildPrisma();
    prisma.performanceReview.findUnique.mockResolvedValue(REVIEW);
    prisma.employee.findFirst.mockResolvedValue({ id: "emp-1" });
    const service = buildService(prisma);

    await expect(service.acknowledge("user-1", "review-1")).rejects.toBeInstanceOf(BadRequestException);
  });

  it("acknowledge: succeeds for the subject employee once submitted", async () => {
    const prisma = buildPrisma();
    prisma.performanceReview.findUnique.mockResolvedValue({ ...REVIEW, status: "submitted" });
    prisma.employee.findFirst.mockResolvedValue({ id: "emp-1" });
    prisma.performanceReview.update.mockResolvedValue({ id: "review-1", status: "acknowledged" });
    const service = buildService(prisma);

    await service.acknowledge("user-1", "review-1");
    expect(prisma.performanceReview.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "acknowledged" }) }),
    );
  });

  it("throws NotFound for a nonexistent review", async () => {
    const prisma = buildPrisma();
    prisma.employee.findFirst.mockResolvedValue({ id: "emp-1" });
    prisma.performanceReview.findUnique.mockResolvedValue(null);
    const service = buildService(prisma);

    await expect(service.acknowledge("user-1", "missing")).rejects.toBeInstanceOf(NotFoundException);
  });
});
