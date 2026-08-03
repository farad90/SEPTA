import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "../../generated/prisma";
import { PrismaService } from "../prisma/prisma.service";
import { CreateDepartmentDto, UpdateDepartmentDto } from "./dto/department.dto";

@Injectable()
export class DepartmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    return this.prisma.department.findMany({
      include: {
        headEmployee: { select: { id: true, fullName: true } },
        ourEntity: { select: { id: true, entityName: true } },
        _count: { select: { employees: true } },
      },
      orderBy: { departmentName: "asc" },
    });
  }

  async getById(id: string) {
    const department = await this.prisma.department.findUnique({
      where: { id },
      include: {
        headEmployee: { select: { id: true, fullName: true } },
        ourEntity: { select: { id: true, entityName: true } },
        parentDepartment: { select: { id: true, departmentName: true } },
      },
    });
    if (!department) {
      throw new NotFoundException("بخش یافت نشد");
    }
    return department;
  }

  async create(dto: CreateDepartmentDto) {
    return this.prisma.department.create({
      data: dto,
      include: { headEmployee: { select: { id: true, fullName: true } } },
    });
  }

  async update(id: string, dto: UpdateDepartmentDto) {
    await this.getById(id);

    if (dto.headEmployeeId) {
      const head = await this.prisma.employee.findUnique({
        where: { id: dto.headEmployeeId },
        select: { departmentId: true },
      });
      if (!head) {
        throw new NotFoundException("کارمند سرپرست یافت نشد");
      }
      if (head.departmentId !== id) {
        throw new BadRequestException("سرپرست بخش باید عضو همان بخش باشه");
      }
    }

    return this.prisma.department.update({
      where: { id },
      data: dto,
      include: { headEmployee: { select: { id: true, fullName: true } } },
    });
  }

  async delete(id: string) {
    await this.getById(id);
    try {
      await this.prisma.department.delete({ where: { id } });
      return { success: true };
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2003") {
        throw new BadRequestException(
          "این بخش جای دیگه‌ای از سیستم استفاده شده (پرسنل، بخش زیرمجموعه، نامه و...) — امکان حذف نیست؛ به‌جاش می‌تونید وضعیتش رو «غیرفعال» کنید",
        );
      }
      throw err;
    }
  }
}
