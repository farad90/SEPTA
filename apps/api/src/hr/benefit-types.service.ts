import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "../../generated/prisma";
import { PrismaService } from "../prisma/prisma.service";
import { CreateBenefitTypeDto, UpdateBenefitTypeDto } from "./dto/benefit-type.dto";

@Injectable()
export class BenefitTypesService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    return this.prisma.benefitType.findMany({ orderBy: { benefitName: "asc" } });
  }

  async create(dto: CreateBenefitTypeDto) {
    return this.prisma.benefitType.create({ data: dto });
  }

  async update(id: string, dto: UpdateBenefitTypeDto) {
    const existing = await this.prisma.benefitType.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException("نوع مزایا یافت نشد");
    }
    return this.prisma.benefitType.update({ where: { id }, data: dto });
  }

  async delete(id: string) {
    const existing = await this.prisma.benefitType.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException("نوع مزایا یافت نشد");
    }
    try {
      await this.prisma.benefitType.delete({ where: { id } });
      return { success: true };
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2003") {
        throw new BadRequestException("این نوع مزایا برای پرسنلی ثبت شده — امکان حذف نیست");
      }
      throw err;
    }
  }
}
