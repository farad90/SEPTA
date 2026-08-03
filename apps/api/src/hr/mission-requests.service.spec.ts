import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { HrAccessService } from "./hr-access.service";
import { MissionRequestsService } from "./mission-requests.service";

function buildPrisma() {
  return {
    employee: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
    },
    missionRequest: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };
}

function buildService(prisma: ReturnType<typeof buildPrisma>) {
  const p = prisma as unknown as PrismaService;
  return new MissionRequestsService(p, new HrAccessService(p));
}

describe("MissionRequestsService", () => {
  it("create: rejects self-service when the user has no linked employee record", async () => {
    const prisma = buildPrisma();
    prisma.employee.findFirst.mockResolvedValue(null);
    const service = buildService(prisma);

    await expect(
      service.create("user-1", { destination: "استانبول", startDate: "2026-04-01", endDate: "2026-04-03" }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("approve: rejects when the caller isn't the direct manager", async () => {
    const prisma = buildPrisma();
    prisma.missionRequest.findUnique.mockResolvedValue({ id: "mr-1", employeeId: "emp-1", status: "pending" });
    prisma.employee.findUnique.mockResolvedValue({ id: "emp-1", directManagerId: "manager-a" });
    prisma.employee.findFirst.mockResolvedValue({ id: "someone-else" });
    const service = buildService(prisma);

    await expect(service.approve("user-1", "mr-1")).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("cancel: maps self-cancellation to 'rejected' since mission_requests has no 'cancelled' state", async () => {
    const prisma = buildPrisma();
    prisma.employee.findFirst.mockResolvedValue({ id: "emp-1" });
    prisma.missionRequest.findUnique.mockResolvedValue({ id: "mr-1", employeeId: "emp-1", status: "pending" });
    prisma.missionRequest.update.mockResolvedValue({ id: "mr-1", status: "rejected" });
    const service = buildService(prisma);

    await service.cancel("user-1", "mr-1");

    expect(prisma.missionRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "rejected" } }),
    );
  });

  it("cancel: rejects a request that's no longer pending", async () => {
    const prisma = buildPrisma();
    prisma.employee.findFirst.mockResolvedValue({ id: "emp-1" });
    prisma.missionRequest.findUnique.mockResolvedValue({ id: "mr-1", employeeId: "emp-1", status: "approved" });
    const service = buildService(prisma);

    await expect(service.cancel("user-1", "mr-1")).rejects.toBeInstanceOf(BadRequestException);
  });
});
