import { Test } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  UnauthorizedException,
} from "@nestjs/common";
import * as argon2 from "argon2";
import { AuthService } from "./auth.service";
import { PrismaService } from "../prisma/prisma.service";
import { PermissionsService } from "../permissions/permissions.service";
import { MailService } from "../mail/mail.service";

jest.mock("argon2");
const mockedArgon2 = argon2 as jest.Mocked<typeof argon2>;

describe("AuthService", () => {
  let service: AuthService;
  let prisma: {
    user: Record<string, jest.Mock>;
    refreshToken: Record<string, jest.Mock>;
  };
  let jwtService: { sign: jest.Mock };
  let mail: { send: jest.Mock; isConfigured: jest.Mock };

  beforeEach(async () => {
    prisma = {
      user: { findUnique: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
      refreshToken: { create: jest.fn(), findFirst: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
    };
    jwtService = { sign: jest.fn().mockReturnValue("signed.jwt.token") };
    mail = { send: jest.fn().mockResolvedValue(true), isConfigured: jest.fn().mockReturnValue(true) };

    const configService = {
      get: jest.fn((key: string) =>
        ({
          JWT_ACCESS_SECRET: "test-access-secret",
          JWT_ACCESS_TTL: "15m",
          JWT_REFRESH_TTL: "7d",
          FRONTEND_URL: "http://localhost:5173",
        })[key],
      ),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwtService },
        { provide: ConfigService, useValue: configService },
        {
          provide: PermissionsService,
          useValue: { getEffectivePermissions: jest.fn().mockResolvedValue([]) },
        },
        { provide: MailService, useValue: mail },
      ],
    }).compile();

    service = moduleRef.get(AuthService);
  });

  describe("register", () => {
    it("creates a user with permissionGroupId=null and stores the requested department", async () => {
      mockedArgon2.hash.mockResolvedValue("hashed-password" as never);
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({
        id: "user-1",
        fullName: "Test User",
        email: "test@example.com",
      });

      const result = await service.register({
        fullName: "Test User",
        mobile: "09121234567",
        email: "test@example.com",
        department: "فروش",
        password: "password123",
      });

      expect(mockedArgon2.hash).toHaveBeenCalledWith("password123");
      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            permissionGroupId: null,
            requestedDepartment: "فروش",
            passwordHash: "hashed-password",
          }),
        }),
      );
      expect(result).toEqual({ id: "user-1", fullName: "Test User", email: "test@example.com" });
    });

    it("throws ConflictException when the email is already registered", async () => {
      prisma.user.findUnique.mockResolvedValue({ id: "existing" });

      await expect(
        service.register({
          fullName: "Test",
          mobile: "09121234567",
          email: "dup@example.com",
          department: "فروش",
          password: "password123",
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe("validateCredentials", () => {
    const approvedUser = {
      id: "user-1",
      passwordHash: "hashed",
      status: "active",
      permissionGroupId: "group-1",
    };

    it("throws UnauthorizedException when no user matches the identifier", async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      await expect(
        service.validateCredentials({ identifier: "nobody@example.com", password: "x" }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it("throws UnauthorizedException on password mismatch", async () => {
      prisma.user.findFirst.mockResolvedValue(approvedUser);
      mockedArgon2.verify.mockResolvedValue(false as never);
      await expect(
        service.validateCredentials({ identifier: "user@example.com", password: "wrong" }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it("throws ForbiddenException when the user is still pending approval (permissionGroupId=null)", async () => {
      prisma.user.findFirst.mockResolvedValue({ ...approvedUser, permissionGroupId: null });
      mockedArgon2.verify.mockResolvedValue(true as never);
      await expect(
        service.validateCredentials({ identifier: "user@example.com", password: "correct" }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it("throws ForbiddenException when the user is inactive", async () => {
      prisma.user.findFirst.mockResolvedValue({ ...approvedUser, status: "inactive" });
      mockedArgon2.verify.mockResolvedValue(true as never);
      await expect(
        service.validateCredentials({ identifier: "user@example.com", password: "correct" }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it("returns the user when credentials are valid and the account is approved", async () => {
      prisma.user.findFirst.mockResolvedValue(approvedUser);
      mockedArgon2.verify.mockResolvedValue(true as never);
      const result = await service.validateCredentials({
        identifier: "user@example.com",
        password: "correct",
      });
      expect(result).toEqual(approvedUser);
    });
  });

  describe("issueTokens / rotateRefreshToken", () => {
    it("issues an access token and stores a hashed refresh token", async () => {
      prisma.refreshToken.create.mockResolvedValue({});

      const tokens = await service.issueTokens("user-1", { userAgent: "jest", ip: "127.0.0.1" });

      expect(jwtService.sign).toHaveBeenCalledWith(
        { sub: "user-1" },
        expect.objectContaining({ secret: "test-access-secret", expiresIn: "15m" }),
      );
      expect(prisma.refreshToken.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: "user-1",
            userAgent: "jest",
            ipAddress: "127.0.0.1",
          }),
        }),
      );
      expect(tokens.accessToken).toBe("signed.jwt.token");
      // 48 بایت randomBytes به hex یعنی ۹۶ کاراکتر
      expect(tokens.refreshToken).toHaveLength(96);
    });

    it("rejects rotating an unknown refresh token", async () => {
      prisma.refreshToken.findFirst.mockResolvedValue(null);
      await expect(service.rotateRefreshToken("bad-token", {})).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it("rejects rotating an expired refresh token", async () => {
      prisma.refreshToken.findFirst.mockResolvedValue({
        id: "rt-1",
        userId: "user-1",
        expiresAt: new Date(Date.now() - 1000),
      });
      await expect(service.rotateRefreshToken("expired-token", {})).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it("revokes the old token and issues a new pair on valid rotation", async () => {
      prisma.refreshToken.findFirst.mockResolvedValue({
        id: "rt-1",
        userId: "user-1",
        expiresAt: new Date(Date.now() + 100_000),
      });
      prisma.refreshToken.update.mockResolvedValue({});
      prisma.refreshToken.create.mockResolvedValue({});

      const tokens = await service.rotateRefreshToken("valid-token", {});

      expect(prisma.refreshToken.update).toHaveBeenCalledWith({
        where: { id: "rt-1" },
        data: { revokedAt: expect.any(Date) },
      });
      expect(tokens.accessToken).toBe("signed.jwt.token");
    });
  });

  describe("forgotPassword", () => {
    it("does nothing silently when no user matches the identifier (no enumeration leak)", async () => {
      prisma.user.findFirst.mockResolvedValue(null);

      await service.forgotPassword("nobody@example.com");

      expect(prisma.user.update).not.toHaveBeenCalled();
      expect(mail.send).not.toHaveBeenCalled();
    });

    it("does nothing for a pending (unapproved) or inactive user", async () => {
      prisma.user.findFirst.mockResolvedValue({
        id: "user-1",
        email: "pending@example.com",
        status: "active",
        permissionGroupId: null,
      });

      await service.forgotPassword("pending@example.com");

      expect(prisma.user.update).not.toHaveBeenCalled();
      expect(mail.send).not.toHaveBeenCalled();
    });

    it("stores a hashed reset token with an expiry and emails the reset link for an active user", async () => {
      prisma.user.findFirst.mockResolvedValue({
        id: "user-1",
        fullName: "کاربر تست",
        email: "user@example.com",
        status: "active",
        permissionGroupId: "group-1",
      });
      prisma.user.update.mockResolvedValue({});

      await service.forgotPassword("user@example.com");

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: "user-1" },
        data: expect.objectContaining({
          passwordResetToken: expect.any(String),
          passwordResetTokenExpiresAt: expect.any(Date),
        }),
      });
      expect(mail.send).toHaveBeenCalledWith(
        expect.objectContaining({ to: "user@example.com", subject: expect.any(String) }),
      );
    });

    it("does not throw when SMTP is not configured (falls back to server-side logging)", async () => {
      prisma.user.findFirst.mockResolvedValue({
        id: "user-1",
        fullName: "کاربر تست",
        email: "user@example.com",
        status: "active",
        permissionGroupId: "group-1",
      });
      prisma.user.update.mockResolvedValue({});
      mail.send.mockResolvedValue(false);

      await expect(service.forgotPassword("user@example.com")).resolves.toBeUndefined();
    });
  });

  describe("resetPassword", () => {
    it("rejects an unknown token", async () => {
      prisma.user.findFirst.mockResolvedValue(null);

      await expect(service.resetPassword("bad-token", "newPassword123")).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it("rejects an expired token", async () => {
      prisma.user.findFirst.mockResolvedValue({
        id: "user-1",
        passwordResetTokenExpiresAt: new Date(Date.now() - 1000),
      });

      await expect(service.resetPassword("expired-token", "newPassword123")).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it("updates the password, clears the token, and revokes all active sessions on success", async () => {
      prisma.user.findFirst.mockResolvedValue({
        id: "user-1",
        passwordResetTokenExpiresAt: new Date(Date.now() + 100_000),
      });
      prisma.user.update.mockResolvedValue({});
      prisma.refreshToken.updateMany.mockResolvedValue({});
      mockedArgon2.hash.mockResolvedValue("new-hashed-password" as never);

      await service.resetPassword("valid-token", "newPassword123");

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: "user-1" },
        data: {
          passwordHash: "new-hashed-password",
          passwordResetToken: null,
          passwordResetTokenExpiresAt: null,
        },
      });
      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: "user-1", revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
    });
  });
});
