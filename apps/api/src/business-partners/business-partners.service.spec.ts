import { BadRequestException, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { PermissionsService } from "../permissions/permissions.service";
import { BusinessPartnersService } from "./business-partners.service";

const CURRENT_USER_ID = "user-1";

// پیش‌فرض تست‌ها: partners.view کامل (بدون محدودیت نوع) — دقیقاً رفتار قبل از فاز ۵۱
function buildPermissions() {
  return {
    getEffectivePermissions: jest
      .fn()
      .mockResolvedValue([{ permissionKey: "partners.view", limitValue: null }]),
  };
}

function buildService(prisma: unknown, permissions = buildPermissions()) {
  return new BusinessPartnersService(
    prisma as unknown as PrismaService,
    permissions as unknown as PermissionsService,
  );
}

function buildPrisma() {
  return {
    businessPartner: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    partnerContact: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    $transaction: jest.fn(async (ops: unknown[]) => Promise.all(ops as Promise<unknown>[])),
    $queryRaw: jest.fn(),
  };
}

describe("BusinessPartnersService", () => {
  it("filters by partner type unless 'all' is requested", async () => {
    const prisma = buildPrisma();
    const service = buildService(prisma);

    await service.list(CURRENT_USER_ID, { type: "supplier" });
    expect(prisma.businessPartner.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { partnerType: "supplier" } }),
    );

    await service.list(CURRENT_USER_ID, { type: "all" });
    expect(prisma.businessPartner.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ where: {} }),
    );
  });

  it("searches company name, country and industry with one query", async () => {
    const prisma = buildPrisma();
    const service = buildService(prisma);

    await service.list(CURRENT_USER_ID, { q: "فولاد" });

    const where = prisma.businessPartner.findMany.mock.calls[0][0].where;
    expect(where.OR).toHaveLength(3);
  });

  it("throws NotFound when updating a missing partner", async () => {
    const prisma = buildPrisma();
    prisma.businessPartner.findUnique.mockResolvedValue(null);
    const service = buildService(prisma);

    await expect(service.update("missing-id", {} as never)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it("throws NotFound when deleting a missing contact", async () => {
    const prisma = buildPrisma();
    prisma.partnerContact.findUnique.mockResolvedValue(null);
    const service = buildService(prisma);

    await expect(service.removeContact("missing-id")).rejects.toBeInstanceOf(NotFoundException);
  });

  it("rejects a contact with no phone, mobile or email", async () => {
    const prisma = buildPrisma();
    prisma.businessPartner.findUnique.mockResolvedValue({ id: "partner-1" });
    const service = buildService(prisma);

    await expect(
      service.addContact("partner-1", { contactName: "علی" } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.partnerContact.create).not.toHaveBeenCalled();
  });

  it("accepts a contact with only an email", async () => {
    const prisma = buildPrisma();
    prisma.businessPartner.findUnique.mockResolvedValue({ id: "partner-1" });
    prisma.partnerContact.create.mockResolvedValue({ id: "c1" });
    const service = buildService(prisma);

    await service.addContact("partner-1", { contactName: "علی", email: "a@x.com" } as never);
    expect(prisma.partnerContact.create).toHaveBeenCalled();
  });

  it("update: keeps the existing mobile in the contact-method check when only editing the name", async () => {
    const prisma = buildPrisma();
    prisma.partnerContact.findUnique.mockResolvedValue({
      id: "c1",
      phone: null,
      mobile: "0912",
      email: null,
    });
    prisma.partnerContact.update.mockResolvedValue({ id: "c1" });
    const service = buildService(prisma);

    await service.updateContact("c1", { contactName: "نام جدید" } as never);
    expect(prisma.partnerContact.update).toHaveBeenCalled();
  });

  it("update: rejects clearing the only contact method (mobile) with nothing to replace it", async () => {
    const prisma = buildPrisma();
    prisma.partnerContact.findUnique.mockResolvedValue({
      id: "c1",
      phone: null,
      mobile: "0912",
      email: null,
    });
    const service = buildService(prisma);

    await expect(
      service.updateContact("c1", { mobile: "" } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("syncs the legacy 'phone' column to the first entry of the phones array", async () => {
    const prisma = buildPrisma();
    prisma.businessPartner.findUnique.mockResolvedValue({ id: "p1" });
    prisma.businessPartner.update.mockResolvedValue({ id: "p1" });
    const service = buildService(prisma);

    await service.update("p1", { phones: ["", "031-123", "031-456"] } as never);

    expect(prisma.businessPartner.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ phones: ["", "031-123", "031-456"], phone: "031-123" }),
      }),
    );
  });

  it("فاز ۳۷: فیلدهای دوزبانه companyNameEn/addressEn رو بدون تغییر پاس می‌ده", async () => {
    const prisma = buildPrisma();
    prisma.businessPartner.findUnique.mockResolvedValue({ id: "p1" });
    prisma.businessPartner.update.mockResolvedValue({ id: "p1" });
    const service = buildService(prisma);

    await service.update("p1", {
      companyNameEn: "Poulad Tajhiz Apadana",
      addressEn: "Tehran, Valiasr St.",
    } as never);

    expect(prisma.businessPartner.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          companyNameEn: "Poulad Tajhiz Apadana",
          addressEn: "Tehran, Valiasr St.",
        }),
      }),
    );
  });
});
