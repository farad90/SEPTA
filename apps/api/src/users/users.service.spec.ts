import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from "@nestjs/common";
import * as argon2 from "argon2";
import { PrismaService } from "../prisma/prisma.service";
import { PermissionsService } from "../permissions/permissions.service";
import { UsersService } from "./users.service";

jest.mock("argon2");
const mockedArgon2 = argon2 as jest.Mocked<typeof argon2>;

const USER_ID = "11111111-1111-1111-1111-111111111111";
const GROUP_ID = "22222222-2222-2222-2222-222222222222";
const ADMIN_ID = "33333333-3333-3333-3333-333333333333";

function buildPrisma() {
  return {
    user: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    permissionGroup: { findUnique: jest.fn() },
    refreshToken: { updateMany: jest.fn() },
    userIdentityDocument: {
      findUnique: jest.fn(),
      deleteMany: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    },
  };
}

function buildService(prisma: ReturnType<typeof buildPrisma>) {
  const permissions = { hasPermission: jest.fn().mockResolvedValue(false) };
  const service = new UsersService(
    prisma as unknown as PrismaService,
    permissions as unknown as PermissionsService,
  );
  return { service, permissions };
}

describe("UsersService", () => {
  it("rejects changing your own group or status (self-lockout protection)", async () => {
    const prisma = buildPrisma();
    const { service } = buildService(prisma);

    await expect(
      service.update(USER_ID, { permissionGroupId: GROUP_ID }, USER_ID),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.update(USER_ID, { status: "inactive" }, USER_ID),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("allows an admin to change another user's group", async () => {
    const prisma = buildPrisma();
    prisma.user.findUnique.mockResolvedValue({ id: "other-user" });
    prisma.permissionGroup.findUnique.mockResolvedValue({ id: GROUP_ID });
    prisma.user.update.mockResolvedValue({ id: "other-user", permissionGroupId: GROUP_ID });
    const { service } = buildService(prisma);

    await service.update("other-user", { permissionGroupId: GROUP_ID }, USER_ID);

    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "other-user" } }),
    );
  });

  it("rejects creating a user with a duplicate email", async () => {
    const prisma = buildPrisma();
    prisma.user.findUnique.mockResolvedValue({ id: "existing" });
    const { service } = buildService(prisma);

    await expect(
      service.create({
        fullName: "کاربر تست",
        email: "dup@x.com",
        initialPassword: "12345678",
        permissionGroupId: GROUP_ID,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("approve fails when the target group does not exist", async () => {
    const prisma = buildPrisma();
    prisma.permissionGroup.findUnique.mockResolvedValue(null);
    const { service } = buildService(prisma);

    await expect(service.approve(USER_ID, GROUP_ID)).rejects.toBeInstanceOf(NotFoundException);
  });

  it("listPending only returns users without a permission group", async () => {
    const prisma = buildPrisma();
    prisma.user.findMany.mockResolvedValue([]);
    const { service } = buildService(prisma);

    await service.listPending();

    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { permissionGroupId: null } }),
    );
  });

  describe("resetPassword (ریست پسورد توسط مدیر)", () => {
    it("throws NotFound when the target user does not exist", async () => {
      const prisma = buildPrisma();
      prisma.user.findUnique.mockResolvedValue(null);
      const { service } = buildService(prisma);

      await expect(
        service.resetPassword("missing-user", { newPassword: "newPassword123" }, ADMIN_ID),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it("hashes and stores the new password, then revokes all active sessions", async () => {
      const prisma = buildPrisma();
      prisma.user.findUnique.mockResolvedValue({ id: USER_ID });
      prisma.user.update.mockResolvedValue({});
      prisma.refreshToken.updateMany.mockResolvedValue({});
      mockedArgon2.hash.mockResolvedValue("new-hashed-password" as never);
      const { service, permissions } = buildService(prisma);
      permissions.hasPermission.mockResolvedValue(false); // target is not an admin

      await service.resetPassword(USER_ID, { newPassword: "newPassword123" }, ADMIN_ID);

      expect(mockedArgon2.hash).toHaveBeenCalledWith("newPassword123");
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: USER_ID },
          data: expect.objectContaining({ passwordHash: "new-hashed-password" }),
        }),
      );
      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: USER_ID, revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
    });

    // P0-E3-F3-T6
    it("rejects resetting another user's password when that target also holds users.manage", async () => {
      const prisma = buildPrisma();
      prisma.user.findUnique.mockResolvedValue({ id: USER_ID });
      const { service, permissions } = buildService(prisma);
      permissions.hasPermission.mockResolvedValue(true); // target IS an admin too

      await expect(
        service.resetPassword(USER_ID, { newPassword: "newPassword123" }, ADMIN_ID),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.user.update).not.toHaveBeenCalled();
      expect(permissions.hasPermission).toHaveBeenCalledWith(USER_ID, "users.manage");
    });

    it("allows a caller to reset their own password even though they hold users.manage", async () => {
      const prisma = buildPrisma();
      prisma.user.findUnique.mockResolvedValue({ id: ADMIN_ID });
      prisma.user.update.mockResolvedValue({});
      prisma.refreshToken.updateMany.mockResolvedValue({});
      mockedArgon2.hash.mockResolvedValue("new-hashed-password" as never);
      const { service, permissions } = buildService(prisma);

      await service.resetPassword(ADMIN_ID, { newPassword: "newPassword123" }, ADMIN_ID);

      // same-user reset never even needs to check the target's permissions
      expect(permissions.hasPermission).not.toHaveBeenCalled();
      expect(prisma.user.update).toHaveBeenCalled();
    });
  });

  describe("پروفایل من (self-service، فاز ۱۵)", () => {
    it("upsertIdentityDocument deletes any existing document in the same slot before creating the new one", async () => {
      const prisma = buildPrisma();
      prisma.user.findUnique.mockResolvedValue({ id: USER_ID });
      const { service } = buildService(prisma);

      await service.upsertIdentityDocument(USER_ID, {
        documentType: "birth_certificate_page",
        pageNumber: 2,
        fileUrl: "2026/07/new.jpg",
      });

      expect(prisma.userIdentityDocument.deleteMany).toHaveBeenCalledWith({
        where: { userId: USER_ID, documentType: "birth_certificate_page", pageNumber: 2 },
      });
      expect(prisma.userIdentityDocument.create).toHaveBeenCalledWith({
        data: {
          userId: USER_ID,
          documentType: "birth_certificate_page",
          pageNumber: 2,
          fileUrl: "2026/07/new.jpg",
        },
      });
      // ترتیب مهمه: حذف باید قبل از ایجاد اتفاق بیفته
      const deleteOrder = prisma.userIdentityDocument.deleteMany.mock.invocationCallOrder[0];
      const createOrder = prisma.userIdentityDocument.create.mock.invocationCallOrder[0];
      expect(deleteOrder).toBeLessThan(createOrder);
    });

    it("upsertIdentityDocument treats a missing pageNumber as null (national id card slot)", async () => {
      const prisma = buildPrisma();
      prisma.user.findUnique.mockResolvedValue({ id: USER_ID });
      const { service } = buildService(prisma);

      await service.upsertIdentityDocument(USER_ID, {
        documentType: "national_id_card",
        fileUrl: "2026/07/card.jpg",
      });

      expect(prisma.userIdentityDocument.deleteMany).toHaveBeenCalledWith({
        where: { userId: USER_ID, documentType: "national_id_card", pageNumber: null },
      });
    });

    it("deleteIdentityDocument rejects deleting another user's document", async () => {
      const prisma = buildPrisma();
      prisma.userIdentityDocument.findUnique.mockResolvedValue({ id: "doc-1", userId: "someone-else" });
      const { service } = buildService(prisma);

      await expect(service.deleteIdentityDocument(USER_ID, "doc-1")).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prisma.userIdentityDocument.delete).not.toHaveBeenCalled();
    });

    it("deleteIdentityDocument succeeds when the document belongs to the caller", async () => {
      const prisma = buildPrisma();
      prisma.userIdentityDocument.findUnique.mockResolvedValue({ id: "doc-1", userId: USER_ID });
      prisma.user.findUnique.mockResolvedValue({ id: USER_ID });
      const { service } = buildService(prisma);

      await service.deleteIdentityDocument(USER_ID, "doc-1");

      expect(prisma.userIdentityDocument.delete).toHaveBeenCalledWith({ where: { id: "doc-1" } });
    });
  });
});
