import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { OutcomeTemplatesService } from "./outcome-templates.service";

const MANAGER_ID = "11111111-1111-1111-1111-111111111111";
const NON_MANAGER_ID = "22222222-2222-2222-2222-222222222222";
const TEMPLATE_ID = "33333333-3333-3333-3333-333333333333";

function buildPrisma() {
  return {
    activityOutcomeTemplate: {
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findUnique: jest.fn(),
    },
    user: { findUnique: jest.fn() },
  };
}

function buildService(prisma: ReturnType<typeof buildPrisma>) {
  return new OutcomeTemplatesService(prisma as unknown as PrismaService);
}

describe("OutcomeTemplatesService", () => {
  it("rejects creating a template if the actor is not a member of the مدیریت group", async () => {
    const prisma = buildPrisma();
    prisma.user.findUnique.mockResolvedValue({ permissionGroup: { groupName: "فروش" } });
    const service = buildService(prisma);

    await expect(
      service.create({ activityType: "call", label: "تست" }, NON_MANAGER_ID),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.activityOutcomeTemplate.create).not.toHaveBeenCalled();
  });

  it("allows a مدیریت member to create a custom template", async () => {
    const prisma = buildPrisma();
    prisma.user.findUnique.mockResolvedValue({ permissionGroup: { groupName: "مدیریت" } });
    prisma.activityOutcomeTemplate.create.mockResolvedValue({ id: TEMPLATE_ID });
    const service = buildService(prisma);

    await service.create({ activityType: "call", label: "تست سفارشی" }, MANAGER_ID);

    expect(prisma.activityOutcomeTemplate.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ isDefault: false, createdByUserId: MANAGER_ID }) }),
    );
  });

  it("rejects editing a default (system-seeded) template even for مدیریت", async () => {
    const prisma = buildPrisma();
    prisma.user.findUnique.mockResolvedValue({ permissionGroup: { groupName: "مدیریت" } });
    prisma.activityOutcomeTemplate.findUnique.mockResolvedValue({ id: TEMPLATE_ID, isDefault: true });
    const service = buildService(prisma);

    await expect(service.update(TEMPLATE_ID, { label: "تغییر" }, MANAGER_ID)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it("rejects deleting a default (system-seeded) template", async () => {
    const prisma = buildPrisma();
    prisma.user.findUnique.mockResolvedValue({ permissionGroup: { groupName: "مدیریت" } });
    prisma.activityOutcomeTemplate.findUnique.mockResolvedValue({ id: TEMPLATE_ID, isDefault: true });
    const service = buildService(prisma);

    await expect(service.remove(TEMPLATE_ID, MANAGER_ID)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.activityOutcomeTemplate.delete).not.toHaveBeenCalled();
  });

  it("allows deleting a custom (non-default) template", async () => {
    const prisma = buildPrisma();
    prisma.user.findUnique.mockResolvedValue({ permissionGroup: { groupName: "مدیریت" } });
    prisma.activityOutcomeTemplate.findUnique.mockResolvedValue({ id: TEMPLATE_ID, isDefault: false });
    const service = buildService(prisma);

    await service.remove(TEMPLATE_ID, MANAGER_ID);

    expect(prisma.activityOutcomeTemplate.delete).toHaveBeenCalledWith({ where: { id: TEMPLATE_ID } });
  });

  it("throws NotFoundException when the template doesn't exist", async () => {
    const prisma = buildPrisma();
    prisma.user.findUnique.mockResolvedValue({ permissionGroup: { groupName: "مدیریت" } });
    prisma.activityOutcomeTemplate.findUnique.mockResolvedValue(null);
    const service = buildService(prisma);

    await expect(service.remove(TEMPLATE_ID, MANAGER_ID)).rejects.toBeInstanceOf(NotFoundException);
  });
});
