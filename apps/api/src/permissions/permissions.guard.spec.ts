import { ExecutionContext, ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { PermissionsGuard } from "./permissions.guard";
import { PermissionsService } from "./permissions.service";

function createContext(user?: { userId: string }): ExecutionContext {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as unknown as ExecutionContext;
}

describe("PermissionsGuard", () => {
  let reflector: { getAllAndOverride: jest.Mock };
  let permissionsService: { getEffectivePermissions: jest.Mock };
  let guard: PermissionsGuard;

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() };
    permissionsService = { getEffectivePermissions: jest.fn() };
    guard = new PermissionsGuard(
      reflector as unknown as Reflector,
      permissionsService as unknown as PermissionsService,
    );
  });

  it("allows access when the route requires no permissions", async () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    const result = await guard.canActivate(createContext({ userId: "user-1" }));
    expect(result).toBe(true);
    expect(permissionsService.getEffectivePermissions).not.toHaveBeenCalled();
  });

  it("throws ForbiddenException when there is no authenticated user", async () => {
    reflector.getAllAndOverride.mockReturnValue(["users.view_pending"]);
    await expect(guard.canActivate(createContext(undefined))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it("throws ForbiddenException when the user is missing a required permission", async () => {
    reflector.getAllAndOverride.mockReturnValue(["users.approve", "users.assign_permission_group"]);
    permissionsService.getEffectivePermissions.mockResolvedValue([
      { permissionKey: "users.approve", limitValue: null },
    ]);
    await expect(
      guard.canActivate(createContext({ userId: "user-1" })),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("allows access when the user has every required permission", async () => {
    reflector.getAllAndOverride.mockReturnValue(["users.view_pending"]);
    permissionsService.getEffectivePermissions.mockResolvedValue([
      { permissionKey: "users.view_pending", limitValue: null },
    ]);
    const result = await guard.canActivate(createContext({ userId: "user-1" }));
    expect(result).toBe(true);
  });
});
