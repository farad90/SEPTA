import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "../../generated/prisma";
import { PrismaService } from "../prisma/prisma.service";
import { PermissionsService } from "../permissions/permissions.service";
import {
  CreatePartnerDto,
  ListPartnersQueryDto,
  UpdatePartnerDto,
} from "./dto/partner.dto";
import { CreateContactDto, UpdateContactDto } from "./dto/contact.dto";

// طبق طراحی اولیه (erp-database-design.md دامنه ۱): فروش فقط مشتری، بازرگانی فقط
// تأمین‌کننده/شرکت حمل رو ببینه — partner_type='both' برای هر دو گروه قابل‌مشاهده‌ست
const CUSTOMER_VISIBLE_TYPES = ["customer", "both"];
const SUPPLIER_VISIBLE_TYPES = ["supplier", "both", "freight_forwarder"];

const SIMILARITY_THRESHOLD = 0.3;
const DEFAULT_PAGE_SIZE = 20;

export interface SimilarPartner {
  id: string;
  companyName: string;
  partnerType: string;
  similarity: number;
}

@Injectable()
export class BusinessPartnersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissions: PermissionsService,
  ) {}

  /**
   * null = بدون محدودیت (partners.view کامل رو داره). آرایه = فقط این partner_type ها.
   * کسی که هیچ‌کدوم از سه کلید رو نداشته باشه، دسترسی نداره (ForbiddenException).
   */
  private async resolveAllowedTypes(userId: string): Promise<string[] | null> {
    const effective = await this.permissions.getEffectivePermissions(userId);
    const keys = new Set(effective.map((p) => p.permissionKey));
    if (keys.has("partners.view")) return null;

    const allowed = new Set<string>();
    if (keys.has("partners.view_customers")) CUSTOMER_VISIBLE_TYPES.forEach((t) => allowed.add(t));
    if (keys.has("partners.view_suppliers")) SUPPLIER_VISIBLE_TYPES.forEach((t) => allowed.add(t));

    if (allowed.size === 0) {
      throw new ForbiddenException("دسترسی کافی برای مشاهده شرکت‌ها ندارید");
    }
    return [...allowed];
  }

  async list(userId: string, query: ListPartnersQueryDto) {
    const allowedTypes = await this.resolveAllowedTypes(userId);
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE;

    const where: Prisma.BusinessPartnerWhereInput = {};
    if (query.type && query.type !== "all") {
      where.partnerType = query.type;
    }
    if (allowedTypes) {
      where.partnerType = where.partnerType
        ? (allowedTypes.includes(where.partnerType as string) ? where.partnerType : "__none__")
        : { in: allowedTypes };
    }
    if (query.q) {
      where.OR = [
        { companyName: { contains: query.q, mode: "insensitive" } },
        { country: { contains: query.q, mode: "insensitive" } },
        { industry: { contains: query.q, mode: "insensitive" } },
      ];
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.businessPartner.findMany({
        where,
        include: { contacts: true },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.businessPartner.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }

  /** هشدار شباهت نام هنگام ثبت — pg_trgm similarity روی ایندکس gin موجود baseline */
  async findSimilar(name: string): Promise<SimilarPartner[]> {
    return this.prisma.$queryRaw<SimilarPartner[]>`
      SELECT id,
             company_name AS "companyName",
             partner_type AS "partnerType",
             similarity(company_name, ${name}) AS similarity
      FROM business_partners
      WHERE similarity(company_name, ${name}) > ${SIMILARITY_THRESHOLD}
      ORDER BY similarity DESC
      LIMIT 5
    `;
  }

  async create(dto: CreatePartnerDto, createdBy: string) {
    const data = this.toPartnerData(dto, { createdBy });
    if (!data.shortCodeEn) {
      data.shortCodeEn = this.deriveShortCode(dto.companyNameEn);
    }
    return this.prisma.businessPartner.create({
      data,
      include: { contacts: true },
    });
  }

  /** اگه کاربر کد اختصاری وارد نکرده باشه، از حروف اول companyNameEn می‌سازه (مثلاً "General Trading srl" -> "GTS") */
  private deriveShortCode(companyNameEn?: string | null): string | undefined {
    if (!companyNameEn?.trim()) {
      return undefined;
    }
    const initials = companyNameEn
      .trim()
      .split(/\s+/)
      .map((word) => word[0])
      .filter((ch) => /[a-zA-Z]/.test(ch))
      .join("")
      .toUpperCase();
    return initials || undefined;
  }

  async getById(id: string, userId: string) {
    const allowedTypes = await this.resolveAllowedTypes(userId);
    const partner = await this.prisma.businessPartner.findUnique({
      where: { id },
      include: { contacts: { orderBy: { createdAt: "asc" } } },
    });
    // اگه نوع این شرکت جزو دسترسی کاربر نباشه، مثل «پیدا نشد» رفتار می‌کنیم (بدون افشای وجودش)
    if (!partner || (allowedTypes && !allowedTypes.includes(partner.partnerType))) {
      throw new NotFoundException("شرکت یافت نشد");
    }
    return partner;
  }

  /** بدون فیلتر نوع — برای عملیات‌هایی که با دسترسی مستقل خودشون (edit/delete/create) گیت شدن */
  private async assertExists(id: string) {
    const partner = await this.prisma.businessPartner.findUnique({ where: { id } });
    if (!partner) {
      throw new NotFoundException("شرکت یافت نشد");
    }
    return partner;
  }

  async update(id: string, dto: UpdatePartnerDto) {
    await this.assertExists(id);
    const data = this.toPartnerData(dto, { updatedAt: new Date() });
    if (!data.shortCodeEn && dto.companyNameEn) {
      data.shortCodeEn = this.deriveShortCode(dto.companyNameEn);
    }
    return this.prisma.businessPartner.update({
      where: { id },
      data,
      include: { contacts: true },
    });
  }

  /** phones آرایه‌ست؛ ستون قدیمی phone برای سازگاری = اولین شماره */
  private toPartnerData(
    dto: CreatePartnerDto | UpdatePartnerDto,
    extra: Record<string, unknown>,
  ) {
    const { phones, registrationDate, ...rest } = dto;
    return {
      ...rest,
      ...extra,
      ...(phones !== undefined
        ? { phones, phone: phones.filter((p) => p.trim())[0] ?? null }
        : {}),
      ...(registrationDate !== undefined
        ? { registrationDate: registrationDate ? new Date(registrationDate) : null }
        : {}),
    };
  }

  async remove(id: string) {
    await this.assertExists(id);
    await this.prisma.businessPartner.delete({ where: { id } });
    return { success: true };
  }

  async addContact(partnerId: string, dto: CreateContactDto) {
    await this.assertExists(partnerId);
    this.assertHasContactMethod(dto);
    return this.prisma.partnerContact.create({ data: { ...dto, partnerId } });
  }

  async updateContact(contactId: string, dto: UpdateContactDto) {
    const contact = await this.prisma.partnerContact.findUnique({ where: { id: contactId } });
    if (!contact) {
      throw new NotFoundException("رابط یافت نشد");
    }
    // قانون روی نتیجه نهایی (مقادیر جدید روی قبلی) چک می‌شه
    this.assertHasContactMethod({
      phone: dto.phone !== undefined ? dto.phone : contact.phone ?? undefined,
      mobile: dto.mobile !== undefined ? dto.mobile : contact.mobile ?? undefined,
      email: dto.email !== undefined ? dto.email : contact.email ?? undefined,
    });
    return this.prisma.partnerContact.update({
      where: { id: contactId },
      data: { ...dto, updatedAt: new Date() },
    });
  }

  /** حداقل یکی از تلفن/موبایل/ایمیل برای رابط الزامیه */
  private assertHasContactMethod(contact: { phone?: string; mobile?: string; email?: string }) {
    if (!contact.phone?.trim() && !contact.mobile?.trim() && !contact.email?.trim()) {
      throw new BadRequestException(
        "حداقل یکی از فیلدهای تلفن، موبایل یا ایمیل برای رابط الزامیه",
      );
    }
  }

  async removeContact(contactId: string) {
    const contact = await this.prisma.partnerContact.findUnique({ where: { id: contactId } });
    if (!contact) {
      throw new NotFoundException("رابط یافت نشد");
    }
    await this.prisma.partnerContact.delete({ where: { id: contactId } });
    return { success: true };
  }
}
