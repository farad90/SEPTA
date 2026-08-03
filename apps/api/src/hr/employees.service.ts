import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "../../generated/prisma";
import { PrismaService } from "../prisma/prisma.service";
import {
  AssignEmployeeNumberDto,
  CreateEmployeeDto,
  ListEmployeesQueryDto,
  UpdateEmployeeDto,
  UpdateMyEmployeeDto,
} from "./dto/employee.dto";
import { CreateContractDto, UpdateContractDto } from "./dto/employee-contract.dto";

const SIMILARITY_THRESHOLD = 0.3;

export interface SimilarEmployee {
  id: string;
  fullName: string;
  employeeNumber: string;
  similarity: number;
}

const EMPLOYEE_INCLUDE = {
  department: { select: { id: true, departmentName: true } },
  directManager: { select: { id: true, fullName: true } },
  ourEntity: { select: { id: true, entityName: true } },
  contracts: { orderBy: { startDate: "desc" as const } },
} satisfies Prisma.EmployeeInclude;

@Injectable()
export class EmployeesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListEmployeesQueryDto) {
    const where: Prisma.EmployeeWhereInput = {};
    if (query.departmentId) {
      where.departmentId = query.departmentId;
    }
    if (query.status) {
      where.employmentStatus = query.status;
    }
    if (query.q) {
      where.OR = [
        { fullName: { contains: query.q, mode: "insensitive" } },
        { employeeNumber: { contains: query.q, mode: "insensitive" } },
      ];
    }

    return this.prisma.employee.findMany({
      where,
      include: {
        department: { select: { id: true, departmentName: true } },
        ourEntity: { select: { id: true, entityName: true } },
      },
      orderBy: { fullName: "asc" },
    });
  }

  /** هشدار شباهت نام هنگام ثبت — همون الگوی BusinessPartnersService.findSimilar */
  async findSimilar(name: string): Promise<SimilarEmployee[]> {
    return this.prisma.$queryRaw<SimilarEmployee[]>`
      SELECT id,
             full_name AS "fullName",
             employee_number AS "employeeNumber",
             similarity(full_name, ${name}) AS similarity
      FROM employees
      WHERE similarity(full_name, ${name}) > ${SIMILARITY_THRESHOLD}
      ORDER BY similarity DESC
      LIMIT 5
    `;
  }

  async getById(id: string) {
    const employee = await this.prisma.employee.findUnique({
      where: { id },
      include: EMPLOYEE_INCLUDE,
    });
    if (!employee) {
      throw new NotFoundException("پرسنل یافت نشد");
    }
    return employee;
  }

  async create(dto: CreateEmployeeDto) {
    if (dto.employeeNumber) {
      const existing = await this.prisma.employee.findUnique({
        where: { employeeNumber: dto.employeeNumber },
      });
      if (existing) {
        throw new ConflictException("این شماره پرسنلی قبلاً ثبت شده");
      }
    }

    // ⚠️ حالت «حساب کاربری دارد»: فقط به کاربر انتخاب‌شده وصل می‌شیم — بدون شماره پرسنلی/شرکت
    // گروه/تاریخ استخدام (مگر مدیر منابع انسانی همون لحظه هم پرشون کنه)؛ تا وقتی شماره پرسنلی
    // نگرفته، این پرونده «کارمند رسمی» محسوب نمی‌شه، فقط یک کاربر سامانه‌ست
    if (dto.userId) {
      const alreadyLinked = await this.prisma.employee.findFirst({ where: { userId: dto.userId } });
      if (alreadyLinked) {
        throw new ConflictException("این کاربر قبلاً به یک پرونده پرسنلی وصل شده");
      }
    }

    return this.prisma.employee.create({
      data: {
        ...dto,
        birthDate: dto.birthDate ? new Date(dto.birthDate) : undefined,
        hireDate: dto.hireDate ? new Date(dto.hireDate) : undefined,
      },
      include: EMPLOYEE_INCLUDE,
    });
  }

  /** تخصیص شماره پرسنلی — لحظه‌ای که یک «کاربر سامانه» رسماً «کارمند شرکت» ثبت می‌شه */
  async assignNumber(id: string, dto: AssignEmployeeNumberDto) {
    const employee = await this.getById(id);
    if (employee.employeeNumber) {
      throw new ConflictException("این پرسنل قبلاً شماره پرسنلی دریافت کرده");
    }

    const ourEntityId = dto.ourEntityId ?? employee.ourEntityId;
    if (!ourEntityId) {
      throw new BadRequestException("شرکت گروه الزامیه");
    }
    const hireDate = dto.hireDate ? new Date(dto.hireDate) : employee.hireDate;
    if (!hireDate) {
      throw new BadRequestException("تاریخ استخدام الزامیه");
    }

    const dupe = await this.prisma.employee.findUnique({ where: { employeeNumber: dto.employeeNumber } });
    if (dupe) {
      throw new ConflictException("این شماره پرسنلی قبلاً ثبت شده");
    }

    return this.prisma.employee.update({
      where: { id },
      data: { employeeNumber: dto.employeeNumber, ourEntityId, hireDate, updatedAt: new Date() },
      include: EMPLOYEE_INCLUDE,
    });
  }

  /** خودسرویس — کارمند فقط اطلاعات فردی خودشو (نه فیلدهای مدیریتی) ویرایش می‌کنه */
  async updateSelf(userId: string, dto: UpdateMyEmployeeDto) {
    const employee = await this.prisma.employee.findFirst({ where: { userId } });
    if (!employee) {
      throw new ForbiddenException("پرونده پرسنلی متصل به این حساب کاربری وجود نداره");
    }
    const { birthDate, ...rest } = dto;
    return this.prisma.employee.update({
      where: { id: employee.id },
      data: {
        ...rest,
        ...(birthDate !== undefined ? { birthDate: new Date(birthDate) } : {}),
        updatedAt: new Date(),
      },
    });
  }

  async update(id: string, dto: UpdateEmployeeDto) {
    await this.getById(id);
    const { birthDate, hireDate, terminationDate, ...rest } = dto;
    return this.prisma.employee.update({
      where: { id },
      data: {
        ...rest,
        ...(birthDate !== undefined ? { birthDate: new Date(birthDate) } : {}),
        ...(hireDate !== undefined ? { hireDate: new Date(hireDate) } : {}),
        ...(terminationDate !== undefined ? { terminationDate: new Date(terminationDate) } : {}),
        updatedAt: new Date(),
      },
      include: EMPLOYEE_INCLUDE,
    });
  }

  async addContract(employeeId: string, dto: CreateContractDto) {
    await this.getById(employeeId);
    return this.prisma.employeeContract.create({
      data: {
        ...dto,
        employeeId,
        startDate: new Date(dto.startDate),
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        signedDate: dto.signedDate ? new Date(dto.signedDate) : undefined,
      },
    });
  }

  async updateContract(contractId: string, dto: UpdateContractDto) {
    const contract = await this.prisma.employeeContract.findUnique({ where: { id: contractId } });
    if (!contract) {
      throw new NotFoundException("قرارداد یافت نشد");
    }
    const { startDate, endDate, signedDate, ...rest } = dto;
    return this.prisma.employeeContract.update({
      where: { id: contractId },
      data: {
        ...rest,
        ...(startDate !== undefined ? { startDate: new Date(startDate) } : {}),
        ...(endDate !== undefined ? { endDate: new Date(endDate) } : {}),
        ...(signedDate !== undefined ? { signedDate: new Date(signedDate) } : {}),
        updatedAt: new Date(),
      },
    });
  }
}
