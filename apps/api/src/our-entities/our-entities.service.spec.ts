import { BadRequestException, NotFoundException } from "@nestjs/common";
import { Prisma } from "../../generated/prisma";
import { PrismaService } from "../prisma/prisma.service";
import { OurEntitiesService } from "./our-entities.service";

function buildPrisma() {
  return {
    ourEntity: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    supplierRfq: { count: jest.fn().mockResolvedValue(0) },
    purchaseOrder: { count: jest.fn().mockResolvedValue(0) },
    financialProposal: { count: jest.fn().mockResolvedValue(0) },
    technicalProposal: { count: jest.fn().mockResolvedValue(0) },
    department: { count: jest.fn().mockResolvedValue(0) },
    employee: { count: jest.fn().mockResolvedValue(0) },
    employeeContract: { count: jest.fn().mockResolvedValue(0) },
    legacyPayrollPeriod: { count: jest.fn().mockResolvedValue(0) },
    letterCounter: { count: jest.fn().mockResolvedValue(0) },
    proposalCounter: { count: jest.fn().mockResolvedValue(0) },
    letter: { count: jest.fn().mockResolvedValue(0) },
  };
}

describe("OurEntitiesService", () => {
  it("listActive() فقط شرکت‌های فعال رو با ترتیب نام برمی‌گردونه", async () => {
    const prisma = buildPrisma();
    const service = new OurEntitiesService(prisma as unknown as PrismaService);

    await service.listActive();

    expect(prisma.ourEntity.findMany).toHaveBeenCalledWith({
      where: { status: "active" },
      orderBy: { entityName: "asc" },
    });
  });

  it("listAll() فعال و غیرفعال رو بدون فیلتر برمی‌گردونه", async () => {
    const prisma = buildPrisma();
    const service = new OurEntitiesService(prisma as unknown as PrismaService);

    await service.listAll();

    expect(prisma.ourEntity.findMany).toHaveBeenCalledWith({
      orderBy: { entityName: "asc" },
    });
  });

  it("getById() یافت‌نشدن رو NotFound می‌کنه", async () => {
    const prisma = buildPrisma();
    prisma.ourEntity.findUnique.mockResolvedValue(null);
    const service = new OurEntitiesService(prisma as unknown as PrismaService);

    await expect(service.getById("missing")).rejects.toBeInstanceOf(NotFoundException);
  });

  it("create() کد اختصاری تکراری رو رد می‌کنه", async () => {
    const prisma = buildPrisma();
    prisma.ourEntity.findUnique.mockResolvedValue({ id: "existing" });
    const service = new OurEntitiesService(prisma as unknown as PrismaService);

    await expect(
      service.create({
        entityName: "شرکت جدید",
        shortCode: "GT",
        calendarType: "gregorian",
        country: "Italy",
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.ourEntity.create).not.toHaveBeenCalled();
  });

  it("create() رکورد جدید رو با کد یکتا می‌سازه", async () => {
    const prisma = buildPrisma();
    prisma.ourEntity.findUnique.mockResolvedValue(null);
    prisma.ourEntity.create.mockResolvedValue({ id: "new-1" });
    const service = new OurEntitiesService(prisma as unknown as PrismaService);

    const dto = {
      entityName: "شرکت جدید",
      shortCode: "NEW",
      calendarType: "gregorian",
      country: "Italy",
    };
    await service.create(dto);

    expect(prisma.ourEntity.create).toHaveBeenCalledWith({ data: dto });
  });

  it("update() وقتی shortCode جدید متعلق به رکورد دیگه‌ست رد می‌کنه", async () => {
    const prisma = buildPrisma();
    prisma.ourEntity.findUnique
      .mockResolvedValueOnce({ id: "entity-1" }) // getById
      .mockResolvedValueOnce({ id: "entity-2" }); // shortCode duplicate check
    const service = new OurEntitiesService(prisma as unknown as PrismaService);

    await expect(
      service.update("entity-1", { shortCode: "DUP" }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.ourEntity.update).not.toHaveBeenCalled();
  });

  it("update() وقتی shortCode متعلق به خودشه اجازه می‌ده", async () => {
    const prisma = buildPrisma();
    prisma.ourEntity.findUnique
      .mockResolvedValueOnce({ id: "entity-1" }) // getById
      .mockResolvedValueOnce({ id: "entity-1" }); // shortCode duplicate check — خودشه
    prisma.ourEntity.update.mockResolvedValue({ id: "entity-1" });
    const service = new OurEntitiesService(prisma as unknown as PrismaService);

    await service.update("entity-1", { shortCode: "پ ت", address: "تهران" });
    expect(prisma.ourEntity.update).toHaveBeenCalledWith({
      where: { id: "entity-1" },
      data: { shortCode: "پ ت", address: "تهران" },
    });
  });

  it("remove() یک شرکت استفاده‌نشده رو واقعاً حذف می‌کنه", async () => {
    const prisma = buildPrisma();
    prisma.ourEntity.findUnique.mockResolvedValue({ id: "entity-1" });
    prisma.ourEntity.delete.mockResolvedValue({ id: "entity-1" });
    const service = new OurEntitiesService(prisma as unknown as PrismaService);

    const result = await service.remove("entity-1");

    expect(prisma.ourEntity.delete).toHaveBeenCalledWith({ where: { id: "entity-1" } });
    expect(result).toEqual({ success: true });
  });

  it("remove() وقتی شرکت جای دیگه‌ای استفاده شده، پیام دقیق شامل محل‌های استفاده می‌ده", async () => {
    const prisma = buildPrisma();
    prisma.ourEntity.findUnique.mockResolvedValue({ id: "entity-1" });
    prisma.supplierRfq.count.mockResolvedValue(2);
    prisma.financialProposal.count.mockResolvedValue(1);
    const service = new OurEntitiesService(prisma as unknown as PrismaService);

    await expect(service.remove("entity-1")).rejects.toThrow(
      /استعلام از تأمین‌کننده \(RFQ\) \(2 مورد\).*پیشنهاد مالی به مشتری \(1 مورد\)/,
    );
    expect(prisma.ourEntity.delete).not.toHaveBeenCalled();
  });

  it("remove() وقتی هم‌زمان با درخواست دیگه‌ای استفاده می‌شه (race condition روی FK) هم پیام فارسی می‌ده", async () => {
    const prisma = buildPrisma();
    prisma.ourEntity.findUnique.mockResolvedValue({ id: "entity-1" });
    prisma.ourEntity.delete.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Foreign key constraint failed", {
        code: "P2003",
        clientVersion: "5.22.0",
      }),
    );
    const service = new OurEntitiesService(prisma as unknown as PrismaService);

    await expect(service.remove("entity-1")).rejects.toBeInstanceOf(BadRequestException);
  });

  it("getUsage() فقط ردیف‌های با شمار بیشتر از صفر رو برمی‌گردونه", async () => {
    const prisma = buildPrisma();
    prisma.employee.count.mockResolvedValue(3);
    const service = new OurEntitiesService(prisma as unknown as PrismaService);

    const usage = await service.getUsage("entity-1");

    expect(usage).toEqual([{ label: "پرسنل", count: 3 }]);
  });

  it("remove() یافت‌نشدن رو NotFound می‌کنه", async () => {
    const prisma = buildPrisma();
    prisma.ourEntity.findUnique.mockResolvedValue(null);
    const service = new OurEntitiesService(prisma as unknown as PrismaService);

    await expect(service.remove("missing")).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.ourEntity.delete).not.toHaveBeenCalled();
  });
});
