import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "../../generated/prisma";
import { PrismaService } from "../prisma/prisma.service";
import { CreateOurEntityDto, UpdateOurEntityDto } from "./dto/our-entity.dto";

@Injectable()
export class OurEntitiesService {
  constructor(private readonly prisma: PrismaService) {}

  // برای دراپ‌داون‌های RFQ/PO — هر کاربر لاگین‌شده، فقط شرکت‌های فعال
  listActive() {
    return this.prisma.ourEntity.findMany({
      where: { status: "active" },
      orderBy: { entityName: "asc" },
    });
  }

  // برای پنل مدیریتی — فعال و غیرفعال، فقط our_entities.manage
  listAll() {
    return this.prisma.ourEntity.findMany({
      orderBy: { entityName: "asc" },
    });
  }

  async getById(id: string) {
    const entity = await this.prisma.ourEntity.findUnique({ where: { id } });
    if (!entity) {
      throw new NotFoundException("شرکت گروه یافت نشد");
    }
    return entity;
  }

  async create(dto: CreateOurEntityDto) {
    const existing = await this.prisma.ourEntity.findUnique({
      where: { shortCode: dto.shortCode },
    });
    if (existing) {
      throw new BadRequestException("کد اختصاری تکراریه");
    }
    return this.prisma.ourEntity.create({ data: dto });
  }

  async update(id: string, dto: UpdateOurEntityDto) {
    await this.getById(id);

    if (dto.shortCode) {
      const existing = await this.prisma.ourEntity.findUnique({
        where: { shortCode: dto.shortCode },
      });
      if (existing && existing.id !== id) {
        throw new BadRequestException("کد اختصاری تکراریه");
      }
    }

    return this.prisma.ourEntity.update({ where: { id }, data: dto });
  }

  /**
   * فهرست کامل جاهایی که یک شرکت گروه ممکنه بهش ارجاع داده شده باشه (هر جدولی که
   * our_entity_id/سه ستون فرستنده-گیرنده-صادرکننده نامه FK داره) — برای پیام حذف دقیق
   * (نه فقط «جای دیگه استفاده شده») تا کاربر بدونه دقیقاً کجا رو باید اصلاح کنه
   */
  async getUsage(id: string) {
    const checks: Array<[string, Promise<number>]> = [
      ["استعلام از تأمین‌کننده (RFQ)", this.prisma.supplierRfq.count({ where: { ourEntityId: id } })],
      ["سفارش خرید (PO)", this.prisma.purchaseOrder.count({ where: { ourEntityId: id } })],
      ["پیشنهاد مالی به مشتری", this.prisma.financialProposal.count({ where: { ourEntityId: id } })],
      ["پیشنهاد فنی به مشتری", this.prisma.technicalProposal.count({ where: { ourEntityId: id } })],
      ["بخش سازمانی (منابع انسانی)", this.prisma.department.count({ where: { ourEntityId: id } })],
      ["پرسنل", this.prisma.employee.count({ where: { ourEntityId: id } })],
      ["قرارداد پرسنل", this.prisma.employeeContract.count({ where: { ourEntityId: id } })],
      ["دوره حقوق (قدیمی)", this.prisma.legacyPayrollPeriod.count({ where: { ourEntityId: id } })],
      ["شمارنده شماره‌گذاری نامه", this.prisma.letterCounter.count({ where: { ourEntityId: id } })],
      ["شمارنده شماره‌گذاری پیشنهاد (قدیمی)", this.prisma.proposalCounter.count({ where: { ourEntityId: id } })],
      ["نامه (به‌عنوان فرستنده)", this.prisma.letter.count({ where: { senderOurEntityId: id } })],
      ["نامه (به‌عنوان گیرنده)", this.prisma.letter.count({ where: { receiverOurEntityId: id } })],
      ["نامه (صادرکننده شماره)", this.prisma.letter.count({ where: { issuingEntityId: id } })],
    ];
    const results = await Promise.all(checks.map(([, query]) => query));
    return checks
      .map(([label], i) => ({ label, count: results[i] }))
      .filter((row) => row.count > 0);
  }

  /**
   * چون تقریباً همه‌جای سیستم (RFQ، PO، پرسنل، پیشنهاد، نامه و...) به این جدول ارجاع می‌دن
   * (FK بدون Cascade)، حذف واقعی فقط وقتی ممکنه که شرکت هنوز جایی استفاده نشده باشه —
   * در غیر این صورت پیشنهاد می‌شه «غیرفعال» بشه (status، از قبل موجود بود). قبل از حذف
   * فهرست کامل محل‌های استفاده رو چک می‌کنیم تا پیام خطا دقیق باشه، نه یک جمله کلی
   */
  async remove(id: string) {
    await this.getById(id);

    const usage = await this.getUsage(id);
    if (usage.length > 0) {
      const detail = usage.map((u) => `${u.label} (${u.count} مورد)`).join("، ");
      throw new BadRequestException(
        `این شرکت در جاهای زیر استفاده شده و قابل حذف نیست: ${detail}. ` +
          "برای حذف، ابتدا باید همه این موارد رو به شرکت دیگری منتقل/اصلاح کنید؛ در غیر این صورت به‌جای حذف، از دکمه «ویرایش» وضعیتش رو «غیرفعال» کنید.",
      );
    }

    try {
      await this.prisma.ourEntity.delete({ where: { id } });
      return { success: true };
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2003") {
        throw new BadRequestException(
          "این شرکت هم‌زمان جای دیگری از سیستم استفاده شد — امکان حذف نیست؛ به‌جاش می‌تونید غیرفعالش کنید",
        );
      }
      throw err;
    }
  }
}
