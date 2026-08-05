import { PrismaService } from "../prisma/prisma.service";
import { PermissionsService } from "../permissions/permissions.service";
import { FileAccessService } from "./file-access.service";

const USER_ID = "11111111-1111-1111-1111-111111111111";
const OTHER_USER_ID = "22222222-2222-2222-2222-222222222222";

function buildDeps() {
  const prisma = { inquiry: { findFirst: jest.fn() } };
  const permissions = { hasPermission: jest.fn() };
  const service = new FileAccessService(
    prisma as unknown as PrismaService,
    permissions as unknown as PermissionsService,
  );
  return { service, prisma, permissions };
}

describe("FileAccessService — P0-E3-F1-T1/T2", () => {
  it("allows access when the folder doesn't match any inquiry (documented residual gap, not a bug)", async () => {
    const { service, prisma, permissions } = buildDeps();
    prisma.inquiry.findFirst.mockResolvedValue(null);

    const allowed = await service.canAccessInquiryFolder("2026", USER_ID);

    expect(allowed).toBe(true);
    expect(permissions.hasPermission).not.toHaveBeenCalled();
  });

  it("denies access when the caller lacks inquiry.view entirely", async () => {
    const { service, prisma, permissions } = buildDeps();
    prisma.inquiry.findFirst.mockResolvedValue({
      id: "inq-1",
      salesExpertId: OTHER_USER_ID,
      createdByUserId: OTHER_USER_ID,
    });
    permissions.hasPermission.mockResolvedValue(false);

    const allowed = await service.canAccessInquiryFolder("INQ-2026-0001", USER_ID);

    expect(allowed).toBe(false);
  });

  it("denies access to an inquiry-folder outside the caller's ownership scope", async () => {
    const { service, prisma, permissions } = buildDeps();
    prisma.inquiry.findFirst.mockResolvedValue({
      id: "inq-1",
      salesExpertId: OTHER_USER_ID,
      createdByUserId: OTHER_USER_ID,
    });
    permissions.hasPermission.mockImplementation(
      async (_userId: string, key: string) => key === "inquiry.view",
    );

    const allowed = await service.canAccessInquiryFolder("INQ-2026-0001", USER_ID);

    expect(allowed).toBe(false);
  });

  it("allows access when the caller is the inquiry's sales expert", async () => {
    const { service, prisma, permissions } = buildDeps();
    prisma.inquiry.findFirst.mockResolvedValue({
      id: "inq-1",
      salesExpertId: USER_ID,
      createdByUserId: OTHER_USER_ID,
    });
    permissions.hasPermission.mockImplementation(
      async (_userId: string, key: string) => key === "inquiry.view",
    );

    const allowed = await service.canAccessInquiryFolder("INQ-2026-0001", USER_ID);

    expect(allowed).toBe(true);
  });

  it("allows access to any inquiry-folder when the caller holds inquiry.view_all", async () => {
    const { service, prisma, permissions } = buildDeps();
    prisma.inquiry.findFirst.mockResolvedValue({
      id: "inq-1",
      salesExpertId: OTHER_USER_ID,
      createdByUserId: OTHER_USER_ID,
    });
    permissions.hasPermission.mockResolvedValue(true);

    const allowed = await service.canAccessInquiryFolder("INQ-2026-0001", USER_ID);

    expect(allowed).toBe(true);
  });

  it("upload path requires inquiry.edit, not inquiry.view", async () => {
    const { service, prisma, permissions } = buildDeps();
    prisma.inquiry.findFirst.mockResolvedValue({
      id: "inq-1",
      salesExpertId: USER_ID,
      createdByUserId: USER_ID,
    });
    permissions.hasPermission.mockImplementation(
      async (_userId: string, key: string) => key === "inquiry.view", // has view, NOT edit
    );

    const allowed = await service.canAccessInquiryFolder("INQ-2026-0001", USER_ID, true);

    expect(allowed).toBe(false);
    expect(permissions.hasPermission).toHaveBeenCalledWith(USER_ID, "inquiry.edit");
  });
});
