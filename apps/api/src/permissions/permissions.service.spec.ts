import { PrismaService } from "../prisma/prisma.service";
import { PermissionsService } from "./permissions.service";

describe("PermissionsService", () => {
  it("returns an empty list when the user has no permission group (pending approval)", async () => {
    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue({ permissionGroupId: null }) },
      permissionGroupItem: { findMany: jest.fn() },
    };
    const service = new PermissionsService(prisma as unknown as PrismaService);

    const result = await service.getEffectivePermissions("user-1");

    expect(result).toEqual([]);
    expect(prisma.permissionGroupItem.findMany).not.toHaveBeenCalled();
  });

  it("resolves effective permissions and limit values fresh from the user's group", async () => {
    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue({ permissionGroupId: "group-1" }) },
      permissionGroupItem: {
        findMany: jest.fn().mockResolvedValue([
          { limitValue: null, permission: { permissionKey: "users.approve" } },
          { limitValue: { toString: () => "5000" }, permission: { permissionKey: "order.approve_contract" } },
        ]),
      },
    };
    const service = new PermissionsService(prisma as unknown as PrismaService);

    const result = await service.getEffectivePermissions("user-1");

    expect(result).toEqual([
      { permissionKey: "users.approve", limitValue: null },
      { permissionKey: "order.approve_contract", limitValue: 5000 },
    ]);
  });

  it("hasPermission checks against the effective permission set", async () => {
    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue({ permissionGroupId: "group-1" }) },
      permissionGroupItem: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ limitValue: null, permission: { permissionKey: "users.approve" } }]),
      },
    };
    const service = new PermissionsService(prisma as unknown as PrismaService);

    await expect(service.hasPermission("user-1", "users.approve")).resolves.toBe(true);
    await expect(service.hasPermission("user-1", "users.view_pending")).resolves.toBe(false);
  });
});
