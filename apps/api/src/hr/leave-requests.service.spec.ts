import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { HrAccessService } from "./hr-access.service";
import { LeaveBalancesService } from "./leave-balances.service";
import { AttendanceService } from "./attendance.service";
import { LeaveRequestsService } from "./leave-requests.service";

function buildPrisma() {
  return {
    employee: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
    },
    leaveBalance: {
      findUnique: jest.fn(),
      update: jest.fn(),
      upsert: jest.fn(),
    },
    leaveRequest: {
      create: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    attendanceRecord: {
      upsert: jest.fn(),
    },
  };
}

function buildService(prisma: ReturnType<typeof buildPrisma>) {
  const p = prisma as unknown as PrismaService;
  const access = new HrAccessService(p);
  const balances = new LeaveBalancesService(p);
  const attendance = new AttendanceService(p);
  return new LeaveRequestsService(p, access, balances, attendance);
}

const CREATE_DTO = {
  leaveTypeId: "leave-type-1",
  startDate: "2026-03-10",
  endDate: "2026-03-12",
};

describe("LeaveRequestsService", () => {
  it("create: rejects self-service when the user has no linked employee record", async () => {
    const prisma = buildPrisma();
    prisma.employee.findFirst.mockResolvedValue(null);
    const service = buildService(prisma);

    await expect(service.create("user-1", CREATE_DTO)).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.leaveRequest.create).not.toHaveBeenCalled();
  });

  it("create: rejects when no leave balance is defined for that type/year", async () => {
    const prisma = buildPrisma();
    prisma.employee.findFirst.mockResolvedValue({ id: "emp-1" });
    prisma.leaveBalance.findUnique.mockResolvedValue(null);
    const service = buildService(prisma);

    await expect(service.create("user-1", CREATE_DTO)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.leaveRequest.create).not.toHaveBeenCalled();
  });

  it("create: computes an inclusive days_count and persists the request", async () => {
    const prisma = buildPrisma();
    prisma.employee.findFirst.mockResolvedValue({ id: "emp-1" });
    prisma.leaveBalance.findUnique.mockResolvedValue({ id: "bal-1" });
    prisma.leaveRequest.create.mockResolvedValue({ id: "lr-1" });
    const service = buildService(prisma);

    await service.create("user-1", CREATE_DTO);

    expect(prisma.leaveRequest.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ daysCount: 3, employeeId: "emp-1" }) }),
    );
  });

  it("approve: rejects when the caller isn't the requester's direct manager", async () => {
    const prisma = buildPrisma();
    prisma.leaveRequest.findUnique.mockResolvedValue({
      id: "lr-1",
      employeeId: "emp-1",
      status: "pending",
      startDate: new Date("2026-03-10"),
      endDate: new Date("2026-03-12"),
      leaveTypeId: "leave-type-1",
      daysCount: 3,
    });
    prisma.employee.findUnique.mockResolvedValue({ id: "emp-1", directManagerId: "manager-a" });
    prisma.employee.findFirst.mockResolvedValue({ id: "someone-else" });
    const service = buildService(prisma);

    await expect(service.approve("user-1", "lr-1")).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.leaveRequest.update).not.toHaveBeenCalled();
  });

  it("approve: rejects when the request is no longer pending", async () => {
    const prisma = buildPrisma();
    prisma.leaveRequest.findUnique.mockResolvedValue({
      id: "lr-1",
      employeeId: "emp-1",
      status: "approved",
      startDate: new Date("2026-03-10"),
      endDate: new Date("2026-03-12"),
      leaveTypeId: "leave-type-1",
      daysCount: 3,
    });
    prisma.employee.findUnique.mockResolvedValue({ id: "emp-1", directManagerId: "manager-a" });
    prisma.employee.findFirst.mockResolvedValue({ id: "manager-a" });
    const service = buildService(prisma);

    await expect(service.approve("user-1", "lr-1")).rejects.toBeInstanceOf(BadRequestException);
  });

  it("approve: increments used_days and upserts attendance for every day in range, then marks approved", async () => {
    const prisma = buildPrisma();
    const startDate = new Date("2026-03-10");
    const endDate = new Date("2026-03-12");
    prisma.leaveRequest.findUnique.mockResolvedValue({
      id: "lr-1",
      employeeId: "emp-1",
      status: "pending",
      startDate,
      endDate,
      leaveTypeId: "leave-type-1",
      daysCount: 3,
    });
    prisma.employee.findUnique.mockResolvedValue({ id: "emp-1", directManagerId: "manager-a" });
    prisma.employee.findFirst.mockResolvedValue({ id: "manager-a" });
    prisma.leaveBalance.findUnique.mockResolvedValue({ id: "bal-1" });
    prisma.leaveRequest.update.mockResolvedValue({ id: "lr-1", status: "approved" });
    const service = buildService(prisma);

    await service.approve("user-1", "lr-1");

    expect(prisma.leaveBalance.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "bal-1" }, data: { usedDays: { increment: 3 } } }),
    );
    // ۱۰ تا ۱۲ اسفند/مارس یعنی ۳ روز upsert جداگانه رو attendance_records
    expect(prisma.attendanceRecord.upsert).toHaveBeenCalledTimes(3);
    expect(prisma.leaveRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "approved", approverId: "manager-a" }) }),
    );
  });

  it("cancel: rejects when the requester isn't the one cancelling", async () => {
    const prisma = buildPrisma();
    prisma.employee.findFirst.mockResolvedValue({ id: "emp-1" });
    prisma.leaveRequest.findUnique.mockResolvedValue({ id: "lr-1", employeeId: "someone-else", status: "pending" });
    const service = buildService(prisma);

    await expect(service.cancel("user-1", "lr-1")).rejects.toBeInstanceOf(BadRequestException);
  });

  it("cancel: rejects when the request is no longer pending", async () => {
    const prisma = buildPrisma();
    prisma.employee.findFirst.mockResolvedValue({ id: "emp-1" });
    prisma.leaveRequest.findUnique.mockResolvedValue({ id: "lr-1", employeeId: "emp-1", status: "approved" });
    const service = buildService(prisma);

    await expect(service.cancel("user-1", "lr-1")).rejects.toBeInstanceOf(BadRequestException);
  });

  it("approve: throws NotFound for a nonexistent request", async () => {
    const prisma = buildPrisma();
    prisma.leaveRequest.findUnique.mockResolvedValue(null);
    const service = buildService(prisma);

    await expect(service.approve("user-1", "missing")).rejects.toBeInstanceOf(NotFoundException);
  });
});
