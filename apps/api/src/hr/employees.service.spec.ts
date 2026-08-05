import { ConflictException, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { PermissionsService } from "../permissions/permissions.service";
import { HrAccessService } from "./hr-access.service";
import { EmployeesService } from "./employees.service";

const USER_ID = "11111111-1111-1111-1111-111111111111";
const DEPT_HEAD_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"; // caller's own department
const DEPT_CHILD_ID = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"; // child of DEPT_HEAD_ID
const DEPT_OTHER_ID = "cccccccc-cccc-cccc-cccc-cccccccccccc"; // unrelated department

function buildPrisma() {
  return {
    employee: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    employeeContract: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    department: {
      findMany: jest.fn().mockResolvedValue([
        { id: DEPT_HEAD_ID, parentDepartmentId: null },
        { id: DEPT_CHILD_ID, parentDepartmentId: DEPT_HEAD_ID },
        { id: DEPT_OTHER_ID, parentDepartmentId: null },
      ]),
    },
    $queryRaw: jest.fn(),
  };
}

function buildService(prisma: ReturnType<typeof buildPrisma>) {
  const permissions = { hasPermission: jest.fn().mockResolvedValue(false) };
  const hrAccess = { getMyEmployee: jest.fn().mockResolvedValue({ id: "emp-self", departmentId: DEPT_HEAD_ID }) };
  const service = new EmployeesService(
    prisma as unknown as PrismaService,
    permissions as unknown as PermissionsService,
    hrAccess as unknown as HrAccessService,
  );
  return { service, permissions, hrAccess };
}

describe("EmployeesService", () => {
  it("rejects a duplicate employee number on create", async () => {
    const prisma = buildPrisma();
    prisma.employee.findUnique.mockResolvedValue({ id: "existing" });
    const { service } = buildService(prisma);

    await expect(
      service.create({ employeeNumber: "1001", fullName: "علی", ourEntityId: "e1", hireDate: "2026-01-01" } as never),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.employee.create).not.toHaveBeenCalled();
  });

  it("creates an employee when the number is free", async () => {
    const prisma = buildPrisma();
    prisma.employee.findUnique.mockResolvedValue(null);
    prisma.employee.create.mockResolvedValue({ id: "emp-1" });
    const { service } = buildService(prisma);

    await service.create({ employeeNumber: "1001", fullName: "علی", ourEntityId: "e1", hireDate: "2026-01-01" } as never);
    expect(prisma.employee.create).toHaveBeenCalled();
  });

  it("throws NotFound when updating a missing employee", async () => {
    const prisma = buildPrisma();
    prisma.employee.findUnique.mockResolvedValue(null);
    const { service } = buildService(prisma);

    await expect(service.update("missing-id", {} as never)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it("finds similar employees by name via pg_trgm", async () => {
    const prisma = buildPrisma();
    prisma.$queryRaw.mockResolvedValue([{ id: "e1", fullName: "علی رضایی", employeeNumber: "1001", similarity: 0.5 }]);
    const { service } = buildService(prisma);

    const result = await service.findSimilar("علی رضا");
    expect(prisma.$queryRaw).toHaveBeenCalled();
    expect(result).toHaveLength(1);
  });

  it("throws NotFound when adding a contract for a missing employee", async () => {
    const prisma = buildPrisma();
    prisma.employee.findUnique.mockResolvedValue(null);
    const { service } = buildService(prisma);

    await expect(
      service.addContract("missing-id", { ourEntityId: "e1", contractType: "permanent", startDate: "2026-01-01", baseSalary: 1000, salaryCurrency: "IRR" } as never),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("throws NotFound when updating a missing contract", async () => {
    const prisma = buildPrisma();
    prisma.employeeContract.findUnique.mockResolvedValue(null);
    const { service } = buildService(prisma);

    await expect(service.updateContract("missing-id", {} as never)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

describe("EmployeesService — P0-E3-F2-T4: محدودسازی دسترسی بر مبنای بخش", () => {
  it("list() بدون hr.view_all فقط بخش خودم + زیرشاخه‌ها رو فیلتر می‌کنه", async () => {
    const prisma = buildPrisma();
    const { service, permissions, hrAccess } = buildService(prisma);
    permissions.hasPermission.mockResolvedValue(false);

    await service.list({}, USER_ID);

    expect(hrAccess.getMyEmployee).toHaveBeenCalledWith(USER_ID);
    expect(prisma.employee.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          departmentId: { in: expect.arrayContaining([DEPT_HEAD_ID, DEPT_CHILD_ID]) },
        }),
      }),
    );
    const calledWhere = prisma.employee.findMany.mock.calls[0][0].where;
    expect(calledWhere.departmentId.in).not.toContain(DEPT_OTHER_ID);
  });

  it("list() با hr.view_all هیچ محدودیت بخشی اضافه نمی‌کنه", async () => {
    const prisma = buildPrisma();
    const { service, permissions, hrAccess } = buildService(prisma);
    permissions.hasPermission.mockResolvedValue(true);

    await service.list({}, USER_ID);

    expect(hrAccess.getMyEmployee).not.toHaveBeenCalled();
    const calledWhere = prisma.employee.findMany.mock.calls[0][0].where;
    expect(calledWhere.departmentId).toBeUndefined();
  });

  it("list() بدون hr.view_all، درخواست صریح یک بخش خارج از scope نتیجه‌ی خالی می‌ده (نه دورزدن محدودیت)", async () => {
    const prisma = buildPrisma();
    const { service, permissions } = buildService(prisma);
    permissions.hasPermission.mockResolvedValue(false);

    await service.list({ departmentId: DEPT_OTHER_ID }, USER_ID);

    const calledWhere = prisma.employee.findMany.mock.calls[0][0].where;
    expect(calledWhere.departmentId).toEqual({ in: [] });
  });

  it("list() بدون hr.view_all، درخواست صریح یک بخش داخل scope رو عیناً اعمال می‌کنه", async () => {
    const prisma = buildPrisma();
    const { service, permissions } = buildService(prisma);
    permissions.hasPermission.mockResolvedValue(false);

    await service.list({ departmentId: DEPT_CHILD_ID }, USER_ID);

    const calledWhere = prisma.employee.findMany.mock.calls[0][0].where;
    expect(calledWhere.departmentId).toBe(DEPT_CHILD_ID);
  });

  it("list() برای کاربری که پرونده‌ی پرسنلی متصل نداره، هیچ پرسنلی برنمی‌گردونه (scope خالی، نه خطا)", async () => {
    const prisma = buildPrisma();
    const { service, permissions, hrAccess } = buildService(prisma);
    permissions.hasPermission.mockResolvedValue(false);
    hrAccess.getMyEmployee.mockResolvedValue(null);

    await service.list({}, USER_ID);

    const calledWhere = prisma.employee.findMany.mock.calls[0][0].where;
    expect(calledWhere.departmentId).toEqual({ in: [] });
  });

  it("getById با پرسنل خارج از scope، NotFoundException می‌ده", async () => {
    const prisma = buildPrisma();
    prisma.employee.findUnique.mockResolvedValue({ id: "emp-x", departmentId: DEPT_OTHER_ID });
    const { service, permissions } = buildService(prisma);
    permissions.hasPermission.mockResolvedValue(false);

    await expect(service.getById("emp-x", USER_ID)).rejects.toBeInstanceOf(NotFoundException);
  });

  it("getById با پرسنل داخل یک زیرشاخه از بخش خودم، دسترسی می‌ده", async () => {
    const prisma = buildPrisma();
    prisma.employee.findUnique.mockResolvedValue({ id: "emp-x", departmentId: DEPT_CHILD_ID });
    const { service, permissions } = buildService(prisma);
    permissions.hasPermission.mockResolvedValue(false);

    await expect(service.getById("emp-x", USER_ID)).resolves.toBeDefined();
  });

  it("getById با hr.view_all به پرسنل هر بخشی دسترسی می‌ده", async () => {
    const prisma = buildPrisma();
    prisma.employee.findUnique.mockResolvedValue({ id: "emp-x", departmentId: DEPT_OTHER_ID });
    const { service, permissions } = buildService(prisma);
    permissions.hasPermission.mockResolvedValue(true);

    await expect(service.getById("emp-x", USER_ID)).resolves.toBeDefined();
  });

  it("getById بدون currentUserId (فراخوانی‌های داخلی مثل update/addContract) هیچ محدودیتی اعمال نمی‌کنه", async () => {
    const prisma = buildPrisma();
    prisma.employee.findUnique.mockResolvedValue({ id: "emp-x", departmentId: DEPT_OTHER_ID });
    const { service, permissions } = buildService(prisma);
    permissions.hasPermission.mockResolvedValue(false);

    await expect(service.getById("emp-x")).resolves.toBeDefined();
    expect(permissions.hasPermission).not.toHaveBeenCalled();
  });
});
