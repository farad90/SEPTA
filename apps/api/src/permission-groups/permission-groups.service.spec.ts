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
