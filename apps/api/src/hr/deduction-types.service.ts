import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "../../generated/prisma";
import { PrismaService } from "../prisma/prisma.service";
import { CreateDeductionTypeDto, UpdateDeductionTypeDto } from "./dto/deduction-type.dto";

@Injectable()
export class DeductionTypesService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    return this.prisma.deductionType.findMany({ orderBy: { deductionName: "asc" } });
  }

  async create(dto: CreateDeductionTypeDto) {
    return this.prisma.deductionType.create({ data: dto });
  }

  async update(id: string, dto: UpdateDeductionTypeDto) {
    const existing = await this.prisma.deductionType.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException("نوع کسر یافت نشد");
    }
    return this.prisma.deductionType.update({ where: { id }, data: dto });
  }

  async delete(id: string) {
    const existing = await this.prisma.deductionType.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException("نوع کسر یافت نشد");
    }
    try {
      await this.prisma.deductionType.delete({ where: { id } });
      return { success: true };
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2003") {
        throw new BadRequestException("این نوع کسر برای پرسنلی ثبت شده — امکان حذف نیست");
      }
      throw err;
    }
  }
}
