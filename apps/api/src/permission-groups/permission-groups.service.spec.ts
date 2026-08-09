import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { PermissionGroupsService } from "./permission-groups.service";

const GROUP_ID = "22222222-2222-2222-2222-222222222222";
const ADMIN_ID = "11111111-1111-1111-1111-111111111111";

function buildPrisma(overrides: Record<string, unknown> = {}) {
  return {
    permissionGroup: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    permissionGroupItem: {
      deleteMany: jest.fn(),
      createMany: jest.fn(),
    },
    permission: { findMany: jest.fn() },
    user: { findUnique: jest.fn() },
    $transaction: jest.fn(),
    ...overrides,
  };
}

describe("PermissionGroupsService — قوانین ایمنی", () => {
  it("rejects editing your own permission group (self-lockout protection)", async () => {
    const prisma = buildPrisma();
    prisma.permissionGroup.findUnique.mockResolvedValue({
      id: GROUP_ID,
      isDefault: false,
      groupName: "مدیریت",
    });
    prisma.user.findUnique.mockResolvedValue({ permissionGroupId: GROUP_ID });
    const service = new PermissionGroupsService(prisma as unknown as PrismaService);

    await expect(
      service.update(GROUP_ID, { permissionKeys: [] }, ADMIN_ID),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("rejects renaming a default group", async () => {
    const prisma = buildPrisma();
    prisma.permissionGroup.findUnique.mockResolvedValue({
      id: GROUP_ID,
      isDefault: true,
      groupName: "فروش",
    });
    prisma.user.findUnique.mockResolvedValue({ permissionGroupId: "other-group" });
    const service = new PermissionGroupsService(prisma as unknown as PrismaService);

    await expect(
      service.update(GROUP_ID, { groupName: "فروش پلاس" }, ADMIN_ID),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects deleting a default group", async () => {
    const prisma = buildPrisma();
    prisma.permissionGroup.findUnique.mockResolvedValue({
      id: GROUP_ID,
      isDefault: true,
      groupName: "مالی",
      _count: { users: 0 },
    });
    const service = new PermissionGroupsService(prisma as unknown as PrismaService);

    await expect(service.remove(GROUP_ID, ADMIN_ID)).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects deleting a group that still has members", async () => {
    const prisma = buildPrisma();
    prisma.permissionGroup.findUnique.mockResolvedValue({
      id: GROUP_ID,
      isDefault: false,
      groupName: "گروه سفارشی",
      _count: { users: 3 },
    });
    const service = new PermissionGroupsService(prisma as unknown as PrismaService);

    await expect(service.remove(GROUP_ID, ADMIN_ID)).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects creating a group with unknown permission keys", async () => {
    const prisma = buildPrisma();
    prisma.permissionGroup.findFirst.mockResolvedValue(null);
    prisma.permission.findMany.mockResolvedValue([
      { id: "p1", permissionKey: "partners.view" },
    ]);
    const service = new PermissionGroupsService(prisma as unknown as PrismaService);

    await expect(
      service.create(
        { groupName: "گروه جدید", permissionKeys: ["partners.view", "nonexistent.key"] },
        ADMIN_ID,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects a duplicate group name", async () => {
    const prisma = buildPrisma();
    prisma.permissionGroup.findFirst.mockResolvedValue({ id: "existing" });
    const service = new PermissionGroupsService(prisma as unknown as PrismaService);

    await expect(
      service.create({ groupName: "فروش", permissionKeys: [] }, ADMIN_ID),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("throws NotFound for a missing group", async () => {
    const prisma = buildPrisma();
    prisma.permissionGroup.findUnique.mockResolvedValue(null);
    const service = new PermissionGroupsService(prisma as unknown as PrismaService);

    await expect(service.getById(GROUP_ID)).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe("PermissionGroupsService — تداخل دسترسی‌ها (فاز ۵۸)", () => {
  function permissionRow(key: string) {
    return { id: `id-${key}`, permissionKey: key };
  }

  it("وقتی partners.view (گسترده) حاضره، partners.view_suppliers محدود رو خاموش از ست ذخیره‌شده حذف می‌کنه", async () => {
    const prisma = buildPrisma();
    prisma.permissionGroup.findFirst.mockResolvedValue(null);
    prisma.permission.findMany.mockImplementation(async ({ where }: { where: { permissionKey: { in: string[] } } }) =>
      where.permissionKey.in.map(permissionRow),
    );
    prisma.permissionGroup.create.mockResolvedValue({ id: GROUP_ID });
    prisma.permissionGroup.findUnique.mockResolvedValue({
      id: GROUP_ID,
      groupName: "گروه جدید",
      isDefault: false,
      items: [{ permission: permissionRow("partners.view") }],
      _count: { users: 0 },
    });
    const service = new PermissionGroupsService(prisma as unknown as PrismaService);

    await service.create(
      { groupName: "گروه جدید", permissionKeys: ["partners.view", "partners.view_suppliers"] },
      ADMIN_ID,
    );

    const savedKeys = prisma.permission.findMany.mock.calls[0][0].where.permissionKey.in;
    expect(savedKeys).toContain("partners.view");
    expect(savedKeys).not.toContain("partners.view_suppliers");
  });

  it("inquiry.view_all بدون inquiry.view رو رد می‌کنه", async () => {
    const prisma = buildPrisma();
    prisma.permissionGroup.findFirst.mockResolvedValue(null);
    const service = new PermissionGroupsService(prisma as unknown as PrismaService);

    await expect(
      service.create({ groupName: "گروه جدید", permissionKeys: ["inquiry.view_all"] }, ADMIN_ID),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("جفت proposal.edit_price + proposal.approve_price_reduction رو ذخیره می‌کنه ولی warning برمی‌گردونه", async () => {
    const prisma = buildPrisma();
    prisma.permissionGroup.findUnique.mockResolvedValue({
      id: GROUP_ID,
      isDefault: true,
      groupName: "بازرگانی",
    });
    prisma.user.findUnique.mockResolvedValue({ permissionGroupId: "other-group" });
    prisma.permission.findMany.mockImplementation(async ({ where }: { where: { permissionKey: { in: string[] } } }) =>
      where.permissionKey.in.map(permissionRow),
    );
    prisma.$transaction.mockResolvedValue(undefined);
    prisma.permissionGroup.findUnique.mockResolvedValueOnce({
      id: GROUP_ID,
      isDefault: true,
      groupName: "بازرگانی",
    });
    // getById() query بعد از update
    const itemsAfterSave = ["proposal.edit_price", "proposal.approve_price_reduction"].map((key) => ({
      permission: permissionRow(key),
    }));
    prisma.permissionGroup.findUnique.mockResolvedValueOnce({
      id: GROUP_ID,
      groupName: "بازرگانی",
      isDefault: true,
      items: itemsAfterSave,
      _count: { users: 3 },
    });
    const service = new PermissionGroupsService(prisma as unknown as PrismaService);

    const result = await service.update(
      GROUP_ID,
      { permissionKeys: ["proposal.edit_price", "proposal.approve_price_reduction"] },
      ADMIN_ID,
    );

    expect(result.warnings).toHaveLength(1);
    expect(result.permissionKeys).toEqual(
      expect.arrayContaining(["proposal.edit_price", "proposal.approve_price_reduction"]),
    );
  });
});
