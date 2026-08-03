import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreatePerformanceReviewCycleDto } from "./dto/performance-review-cycle.dto";

@Injectable()
export class PerformanceReviewCyclesService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    return this.prisma.performanceReviewCycle.findMany({ orderBy: { startDate: "desc" } });
  }

  async create(dto: CreatePerformanceReviewCycleDto) {
    return this.prisma.performanceReviewCycle.create({
      data: { cycleName: dto.cycleName, startDate: new Date(dto.startDate), endDate: new Date(dto.endDate) },
    });
  }

  async close(id: string) {
    const cycle = await this.prisma.performanceReviewCycle.findUnique({ where: { id } });
    if (!cycle) {
      throw new NotFoundException("دوره ارزیابی یافت نشد");
    }
    if (cycle.status !== "open") {
      throw new BadRequestException("این دوره از قبل بسته شده");
    }
    return this.prisma.performanceReviewCycle.update({ where: { id }, data: { status: "closed" } });
  }
}
