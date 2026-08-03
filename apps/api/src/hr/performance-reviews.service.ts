import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "../../generated/prisma";
import { PrismaService } from "../prisma/prisma.service";
import { HrAccessService } from "./hr-access.service";
import {
  CreatePerformanceReviewDto,
  SelfReviewDto,
  SubmitReviewDto,
  UpdatePerformanceReviewDto,
} from "./dto/performance-review.dto";

const REVIEW_INCLUDE = {
  items: true,
  cycle: true,
  employee: { select: { id: true, fullName: true } },
  reviewer: { select: { id: true, fullName: true } },
} satisfies Prisma.PerformanceReviewInclude;

@Injectable()
export class PerformanceReviewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: HrAccessService,
  ) {}

  async create(dto: CreatePerformanceReviewDto) {
    return this.prisma.performanceReview.create({
      data: {
        cycleId: dto.cycleId,
        employeeId: dto.employeeId,
        reviewerId: dto.reviewerId,
        items: { create: dto.criteria.map((c) => ({ criterionName: c.criterionName, weightPercent: c.weightPercent })) },
      },
      include: REVIEW_INCLUDE,
    });
  }

  async listForEmployee(employeeId: string) {
    return this.prisma.performanceReview.findMany({
      where: { employeeId },
      include: REVIEW_INCLUDE,
      orderBy: { cycle: { startDate: "desc" } },
    });
  }

  async mineAsEmployee(userId: string) {
    const employee = await this.access.assertMyEmployee(userId);
    return this.prisma.performanceReview.findMany({
      where: { employeeId: employee.id },
      include: REVIEW_INCLUDE,
      orderBy: { cycle: { startDate: "desc" } },
    });
  }

  async mineAsReviewer(userId: string) {
    const employee = await this.access.assertMyEmployee(userId);
    return this.prisma.performanceReview.findMany({
      where: { reviewerId: employee.id },
      include: REVIEW_INCLUDE,
      orderBy: { cycle: { startDate: "desc" } },
    });
  }

  async selfReview(userId: string, id: string, dto: SelfReviewDto) {
    const employee = await this.access.assertMyEmployee(userId);
    const review = await this.getOrThrow(id);
    if (review.employeeId !== employee.id) {
      throw new ForbiddenException("فقط پرسنل موضوع این بررسی می‌تونه خودارزیابی بنویسه");
    }
    if (review.status !== "draft") {
      throw new BadRequestException("این بررسی دیگه در حالت پیش‌نویس نیست");
    }
    return this.prisma.performanceReview.update({
      where: { id },
      data: { selfReviewNotes: dto.selfReviewNotes },
      include: REVIEW_INCLUDE,
    });
  }

  async submit(userId: string, id: string, dto: SubmitReviewDto) {
    const employee = await this.access.assertMyEmployee(userId);
    const review = await this.getOrThrow(id);
    if (review.reviewerId !== employee.id) {
      throw new ForbiddenException("فقط ارزیاب تعیین‌شده این بررسی می‌تونه نمره ثبت کنه");
    }
    if (review.status !== "draft") {
      throw new BadRequestException("این بررسی دیگه در حالت پیش‌نویس نیست");
    }
    const validIds = new Set(review.items.map((i) => i.id));
    for (const item of dto.items) {
      if (!validIds.has(item.id)) {
        throw new BadRequestException("معیار نامعتبر در لیست نمرات");
      }
    }

    return this.prisma.$transaction(async (tx) => {
      for (const item of dto.items) {
        await tx.performanceReviewItem.update({
          where: { id: item.id },
          data: { score: item.score, comments: item.comments },
        });
      }
      return tx.performanceReview.update({
        where: { id },
        data: {
          overallScore: dto.overallScore,
          managerNotes: dto.managerNotes,
          status: "submitted",
          submittedAt: new Date(),
        },
        include: REVIEW_INCLUDE,
      });
    });
  }

  async acknowledge(userId: string, id: string) {
    const employee = await this.access.assertMyEmployee(userId);
    const review = await this.getOrThrow(id);
    if (review.employeeId !== employee.id) {
      throw new ForbiddenException("فقط پرسنل موضوع این بررسی می‌تونه تأیید مشاهده بزنه");
    }
    if (review.status !== "submitted") {
      throw new BadRequestException("این بررسی هنوز نهایی نشده");
    }
    return this.prisma.performanceReview.update({
      where: { id },
      data: { status: "acknowledged", acknowledgedAt: new Date() },
      include: REVIEW_INCLUDE,
    });
  }

  async update(id: string, dto: UpdatePerformanceReviewDto) {
    await this.getOrThrow(id);
    return this.prisma.performanceReview.update({ where: { id }, data: dto, include: REVIEW_INCLUDE });
  }

  private async getOrThrow(id: string) {
    const review = await this.prisma.performanceReview.findUnique({ where: { id }, include: REVIEW_INCLUDE });
    if (!review) {
      throw new NotFoundException("بررسی عملکرد یافت نشد");
    }
    return review;
  }
}
