import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { PermissionsService } from "../permissions/permissions.service";
import { NotificationsService } from "../notifications/notifications.service";
import { LetterNumberService } from "./letter-number.service";
import {
  AddDocumentDto,
  CreateLetterDto,
  ListLettersQueryDto,
  LetterPartyDto,
  ReferLetterDto,
  UpdateDocumentDto,
  UpdateLetterDto,
  WorkflowActionDto,
} from "./dto/correspondence.dto";

const LETTER_INCLUDE = {
  senderOurEntity: { select: { id: true, entityName: true, shortCode: true } },
  senderPartner: { select: { id: true, companyName: true, partnerType: true } },
  senderContact: { select: { id: true, contactName: true } },
  receiverOurEntity: { select: { id: true, entityName: true, shortCode: true } },
  receiverPartner: { select: { id: true, companyName: true, partnerType: true } },
  receiverContact: { select: { id: true, contactName: true } },
  issuingEntity: { select: { id: true, entityName: true, shortCode: true, calendarType: true } },
  creator: { select: { id: true, fullName: true } },
  relatedInquiry: { select: { id: true, internalNumber: true, subject: true } },
  relatedShipment: { select: { id: true, shipmentNumber: true } },
  responsibleUser: { select: { id: true, fullName: true } },
  internalFromDepartment: { select: { id: true, departmentName: true } },
  internalToDepartment: { select: { id: true, departmentName: true } },
  signers: { include: { user: { select: { id: true, fullName: true } } } },
  _count: { select: { documents: true } },
} satisfies import("../../generated/prisma").Prisma.LetterInclude;

type LetterWithRelations = Awaited<ReturnType<CorrespondenceService["getLetterOrThrow"]>>;

/**
 * فاز ۱۳ — مکاتبات و بایگانی اسناد (دامنه ۸). شماره‌گذاری فقط بعد از «ثبت رسمی»
 * صادر می‌شه (بر مبنای شرکت گروه صادرکننده). فیلتر «هر واحد فقط نامه‌های خودش»
 * با تطبیق department و نام گروه دسترسی کاربر پیاده شده — طبق تصمیم فاز ۱۳.
 */
@Injectable()
export class CorrespondenceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly numberService: LetterNumberService,
    private readonly permissions: PermissionsService,
    private readonly notifications: NotificationsService,
  ) {}

  // ------------------------------------------------------------
  // لیست/جزئیات
  // ------------------------------------------------------------

  async list(query: ListLettersQueryDto, userId: string) {
    const canViewAll = await this.permissions.hasPermission(userId, "correspondence.view_all");
    const department = canViewAll ? query.department : await this.getUserDepartment(userId);
    // بدون view_all: هم نامه‌های واحد خودم، هم نامه‌های دریافتی‌ای که مسئول پیگیریشونم (طبق فاز ۲۴)
    // دو شرط OR جدا (دسترسی + جست‌وجو) نمی‌تونن هم‌سطح باشن (کلید تکراری در Prisma.where)، پس هرکدوم تو AND جدا می‌ره
    const letters = await this.prisma.letter.findMany({
      where: {
        type: query.type,
        status: query.status,
        AND: [
          canViewAll ? {} : { OR: [{ department }, { responsibleUserId: userId }] },
          query.q
            ? {
                OR: [
                  { subject: { contains: query.q, mode: "insensitive" as const } },
                  { letterNumber: { contains: query.q, mode: "insensitive" as const } },
                ],
              }
            : {},
        ],
        ...(canViewAll && query.department ? { department: query.department } : {}),
      },
      include: LETTER_INCLUDE,
      orderBy: { createdAt: "desc" },
    });
    return letters.map((l) => this.formatSummary(l));
  }

  async getById(id: string, userId: string) {
    const letter = await this.getLetterOrThrow(id);
    await this.assertVisible(letter, userId);
    await this.prisma.letterAuditLog.create({ data: { letterId: id, userId, action: "viewed" } });
    return this.getDetailData(id);
  }

  // ------------------------------------------------------------
  // ایجاد/ویرایش/حذف
  // ------------------------------------------------------------

  async create(dto: CreateLetterDto, userId: string) {
    this.assertDirectionalFields(dto);

    const isIncoming = dto.type === "incoming";
    const isOutgoing = dto.type === "outgoing";
    const isInternal = dto.type === "internal";

    const letter = await this.prisma.$transaction(async (tx) => {
      const created = await tx.letter.create({
        data: {
          type: dto.type,
          letterDate: new Date(dto.letterDate),
          subject: dto.subject,
          senderOurEntityId: isInternal ? undefined : dto.sender?.ourEntityId,
          senderPartnerId: isInternal ? undefined : dto.sender?.partnerId,
          senderContactId: isInternal ? undefined : dto.sender?.contactId,
          receiverOurEntityId: isInternal ? undefined : dto.receiver?.ourEntityId,
          receiverPartnerId: isInternal ? undefined : dto.receiver?.partnerId,
          receiverContactId: isInternal ? undefined : dto.receiver?.contactId,
          issuingEntityId: dto.issuingEntityId,
          // برای نامه دریافتی، «مسئول پیگیری» جایگزین فیلد واحده — همیشه خالی می‌مونه
          department: isIncoming ? undefined : dto.department,
          priority: dto.priority ?? "normal",
          relatedInquiryId: dto.relatedInquiryId,
          relatedShipmentId: dto.relatedShipmentId,
          description: dto.description,
          createdBy: userId,
          senderReferenceNumber: isIncoming ? dto.senderReferenceNumber : undefined,
          responsibleUserId: isIncoming ? dto.responsibleUserId : undefined,
          internalFromDepartmentId: isInternal ? dto.internalFromDepartmentId : undefined,
          internalToDepartmentId: isInternal ? dto.internalToDepartmentId : undefined,
        },
        include: LETTER_INCLUDE,
      });

      if (isOutgoing && dto.signerUserIds && dto.signerUserIds.length > 0) {
        await tx.letterSigner.createMany({
          data: dto.signerUserIds.map((signerId) => ({ letterId: created.id, userId: signerId })),
        });
      }

      if (isIncoming && dto.responsibleUserId) {
        await tx.letterWorkflowLog.create({
          data: {
            letterId: created.id,
            action: "referred",
            performedBy: userId,
            referredToUserId: dto.responsibleUserId,
            note: "مسئول پیگیری نامه دریافتی",
          },
        });
      }

      return created;
    });

    if (isIncoming && dto.responsibleUserId && dto.responsibleUserId !== userId) {
      await this.notifications.create({
        userId: dto.responsibleUserId,
        type: "letter_responsible_assigned",
        title: `مسئول پیگیری نامه‌ای با موضوع «${letter.subject}» شدید`,
        relatedEntityType: "letter",
        relatedEntityId: letter.id,
      });
    }

    return this.formatSummary(letter);
  }

  async update(id: string, dto: UpdateLetterDto, userId: string) {
    await this.getLetterOrThrow(id);
    if (dto.sender) this.assertPartyValid(dto.sender, "فرستنده");
    if (dto.receiver) this.assertPartyValid(dto.receiver, "گیرنده");

    await this.prisma.letter.update({
      where: { id },
      data: {
        letterDate: dto.letterDate ? new Date(dto.letterDate) : undefined,
        subject: dto.subject,
        senderOurEntityId: dto.sender ? (dto.sender.ourEntityId ?? null) : undefined,
        senderPartnerId: dto.sender ? (dto.sender.partnerId ?? null) : undefined,
        senderContactId: dto.sender ? (dto.sender.contactId ?? null) : undefined,
        receiverOurEntityId: dto.receiver ? (dto.receiver.ourEntityId ?? null) : undefined,
        receiverPartnerId: dto.receiver ? (dto.receiver.partnerId ?? null) : undefined,
        receiverContactId: dto.receiver ? (dto.receiver.contactId ?? null) : undefined,
        issuingEntityId: dto.issuingEntityId,
        department: dto.department,
        priority: dto.priority,
        relatedInquiryId: dto.relatedInquiryId,
        relatedShipmentId: dto.relatedShipmentId,
        description: dto.description,
        updatedAt: new Date(),
      },
    });
    await this.prisma.letterAuditLog.create({ data: { letterId: id, userId, action: "edited" } });
    return this.getDetailData(id);
  }

  async delete(id: string) {
    await this.getLetterOrThrow(id);
    await this.prisma.letter.delete({ where: { id } });
    return { success: true };
  }

  // ------------------------------------------------------------
  // گردش کار
  // ------------------------------------------------------------

  async register(id: string, userId: string) {
    const letter = await this.getLetterOrThrow(id);
    if (letter.status !== "draft") {
      throw new BadRequestException("این نامه قبلاً ثبت رسمی شده");
    }
    // ⚠️ بازخورد کاربر: برای نامه ارسالی، کارشناس باید شماره رو *قبل* از نوشتن/صدور خود نامه
    // بگیره تا روی خودش درج کنه — پس الزام «حداقل یک سند بارگذاری‌شده» فقط برای نامه دریافتی/
    // داخلی معناداره (که سندش از قبل وجود داره، مثلاً اسکن نامه دریافتی)
    if (letter.type !== "outgoing") {
      const documentsCount = await this.prisma.document.count({ where: { relatedLetterId: id } });
      if (documentsCount === 0) {
        throw new BadRequestException("برای ثبت رسمی نامه، حداقل یک تصویر/سند باید بارگذاری شده باشه");
      }
    }

    await this.prisma.$transaction(async (tx) => {
      const letterNumber = await this.numberService.nextNumber(
        tx,
        letter.issuingEntity.id,
        letter.issuingEntity.calendarType,
        letter.issuingEntity.shortCode,
      );
      await tx.letter.update({
        where: { id },
        data: { letterNumber, status: "registered", updatedAt: new Date() },
      });
      await tx.letterWorkflowLog.create({ data: { letterId: id, action: "registered", performedBy: userId } });
    });

    return this.getDetailData(id);
  }

  async refer(id: string, dto: ReferLetterDto, userId: string) {
    const letter = await this.getLetterOrThrow(id);
    await this.prisma.letterWorkflowLog.create({
      data: { letterId: id, action: "referred", performedBy: userId, referredToUserId: dto.referredToUserId, note: dto.note },
    });
    if (dto.referredToUserId !== userId) {
      await this.notifications.create({
        userId: dto.referredToUserId,
        type: "letter_referral",
        title: `نامه‌ای با موضوع «${letter.subject}» به شما ارجاع داده شد`,
        message: dto.note,
        relatedEntityType: "letter",
        relatedEntityId: id,
      });
    }
    return this.getDetailData(id);
  }

  async workflowAction(id: string, dto: WorkflowActionDto, userId: string) {
    await this.getLetterOrThrow(id);
    await this.prisma.$transaction(async (tx) => {
      await tx.letterWorkflowLog.create({ data: { letterId: id, action: dto.action, performedBy: userId, note: dto.note } });
      if (dto.action === "sent" || dto.action === "archived") {
        await tx.letter.update({ where: { id }, data: { status: dto.action, updatedAt: new Date() } });
      }
    });
    return this.getDetailData(id);
  }

  // ------------------------------------------------------------
  // اسناد پیوست
  // ------------------------------------------------------------

  async addDocument(letterId: string, dto: AddDocumentDto, userId: string) {
    await this.getLetterOrThrow(letterId);
    await this.prisma.document.create({
      data: {
        relatedLetterId: letterId,
        fileName: dto.fileName,
        fileType: this.deriveFileType(dto.fileName),
        fileUrl: dto.fileUrl,
        category: dto.category ?? "other",
        uploadedBy: userId,
        tags: dto.tags && dto.tags.length > 0 ? { create: dto.tags.map((tag) => ({ tag })) } : undefined,
      },
    });
    return this.getDetailData(letterId);
  }

  async updateDocument(docId: string, dto: UpdateDocumentDto) {
    const doc = await this.getDocumentOrThrow(docId);
    await this.prisma.$transaction(async (tx) => {
      await tx.document.update({ where: { id: docId }, data: { category: dto.category } });
      if (dto.tags) {
        await tx.documentTag.deleteMany({ where: { documentId: docId } });
        if (dto.tags.length > 0) {
          await tx.documentTag.createMany({ data: dto.tags.map((tag) => ({ documentId: docId, tag })) });
        }
      }
    });
    return this.getDetailData(doc.relatedLetterId!);
  }

  async deleteDocument(docId: string) {
    const doc = await this.getDocumentOrThrow(docId);
    await this.prisma.document.delete({ where: { id: docId } });
    return this.getDetailData(doc.relatedLetterId!);
  }

  // ------------------------------------------------------------
  // Helpers
  // ------------------------------------------------------------

  private async getLetterOrThrow(id: string) {
    const letter = await this.prisma.letter.findUnique({ where: { id }, include: LETTER_INCLUDE });
    if (!letter) throw new NotFoundException("نامه یافت نشد");
    return letter;
  }

  private async getDocumentOrThrow(id: string) {
    const doc = await this.prisma.document.findUnique({ where: { id } });
    if (!doc) throw new NotFoundException("سند یافت نشد");
    return doc;
  }

  private async assertVisible(letter: { department: string | null; responsibleUserId: string | null }, userId: string) {
    const canViewAll = await this.permissions.hasPermission(userId, "correspondence.view_all");
    if (canViewAll) return;
    // مسئول پیگیری یک نامه دریافتی، حتی بدون تطابق واحد، بهش دسترسی داره — جایگزین department برای این نوع
    if (letter.responsibleUserId === userId) return;
    const department = await this.getUserDepartment(userId);
    if (letter.department !== department) {
      throw new NotFoundException("نامه یافت نشد");
    }
  }

  private async getUserDepartment(userId: string): Promise<string | undefined> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { permissionGroup: { select: { groupName: true } } },
    });
    return user?.permissionGroup?.groupName;
  }

  private assertPartyValid(party: LetterPartyDto, label: string) {
    const hasOur = !!party.ourEntityId;
    const hasPartner = !!party.partnerId;
    if (hasOur === hasPartner) {
      throw new BadRequestException(`دقیقاً یکی از «یکی از شرکت‌های ما» یا «طرف بیرونی» باید برای ${label} انتخاب بشه`);
    }
  }

  // فاز ۲۴ — ولیدیشن فرستنده/گیرنده بر مبنای جهت نامه، فقط موقع ساخت نامه (نه ویرایش)
  private assertDirectionalFields(dto: CreateLetterDto) {
    if (dto.type === "internal") {
      if (dto.sender?.ourEntityId || dto.sender?.partnerId || dto.receiver?.ourEntityId || dto.receiver?.partnerId) {
        throw new BadRequestException("برای نامه داخلی فرستنده/گیرنده شرکتی وارد نشه — فقط بخش مبدأ و مقصد لازمه");
      }
      if (!dto.internalFromDepartmentId || !dto.internalToDepartmentId) {
        throw new BadRequestException("برای نامه داخلی، بخش مبدأ و بخش مقصد هر دو الزامیه");
      }
      if (dto.internalFromDepartmentId === dto.internalToDepartmentId) {
        throw new BadRequestException("بخش مبدأ و مقصد نامه داخلی باید متفاوت باشن");
      }
      return;
    }

    if (dto.type === "incoming") {
      if (!dto.sender?.partnerId || dto.sender?.ourEntityId) {
        throw new BadRequestException("فرستنده نامه دریافتی باید یک طرف بیرونی باشه");
      }
      if (!dto.receiver?.ourEntityId || dto.receiver?.partnerId) {
        throw new BadRequestException("گیرنده نامه دریافتی باید یکی از شرکت‌های ما باشه");
      }
      if (!dto.senderReferenceNumber?.trim()) {
        throw new BadRequestException("شماره نامه فرستنده الزامیه");
      }
      if (!dto.responsibleUserId) {
        throw new BadRequestException("مسئول پیگیری نامه دریافتی الزامیه");
      }
      return;
    }

    // outgoing
    if (!dto.sender?.ourEntityId || dto.sender?.partnerId) {
      throw new BadRequestException("فرستنده نامه ارسالی باید یکی از شرکت‌های ما باشه");
    }
    if (!dto.receiver?.partnerId || dto.receiver?.ourEntityId) {
      throw new BadRequestException("گیرنده نامه ارسالی باید یک طرف بیرونی باشه");
    }
    if (!dto.signerUserIds || dto.signerUserIds.length === 0) {
      throw new BadRequestException("حداقل یک امضاکننده برای نامه ارسالی الزامیه");
    }
  }

  private deriveFileType(fileName: string): string {
    const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
    if (ext === "pdf") return "pdf";
    if (["jpg", "jpeg", "png", "gif", "webp"].includes(ext)) return "image";
    if (["xls", "xlsx", "csv"].includes(ext)) return "excel";
    return "other";
  }

  private async getDetailData(id: string) {
    const letter = await this.getLetterOrThrow(id);
    const [documents, workflowLogs, auditLogs] = await Promise.all([
      this.prisma.document.findMany({
        where: { relatedLetterId: id },
        include: { tags: true },
        orderBy: { uploadDate: "desc" },
      }),
      this.prisma.letterWorkflowLog.findMany({
        where: { letterId: id },
        include: {
          performer: { select: { id: true, fullName: true } },
          referredToUser: { select: { id: true, fullName: true } },
        },
        orderBy: { performedAt: "asc" },
      }),
      this.prisma.letterAuditLog.findMany({
        where: { letterId: id },
        include: { user: { select: { id: true, fullName: true } } },
        orderBy: { occurredAt: "desc" },
      }),
    ]);

    return {
      ...this.formatSummary(letter),
      description: letter.description,
      documents: documents.map((d) => ({
        id: d.id,
        fileName: d.fileName,
        fileType: d.fileType,
        fileUrl: d.fileUrl,
        category: d.category,
        tags: d.tags.map((t) => t.tag),
        uploadedBy: d.uploadedBy,
        uploadDate: d.uploadDate,
      })),
      workflowLogs: workflowLogs.map((w) => ({
        id: w.id,
        action: w.action,
        performedBy: w.performer.fullName,
        referredToUser: w.referredToUser?.fullName ?? null,
        note: w.note,
        performedAt: w.performedAt,
      })),
      auditLogs: auditLogs.map((a) => ({
        id: a.id,
        user: a.user.fullName,
        action: a.action,
        occurredAt: a.occurredAt,
      })),
    };
  }

  private formatParty(
    entity: { id: string; entityName: string } | null,
    partner: { id: string; companyName: string; partnerType: string } | null,
    contact: { id: string; contactName: string } | null,
  ) {
    if (entity) return { kind: "our" as const, id: entity.id, name: entity.entityName };
    if (partner) {
      return {
        kind: "partner" as const,
        id: partner.id,
        name: partner.companyName,
        partnerType: partner.partnerType,
        contactName: contact?.contactName ?? null,
      };
    }
    return null;
  }

  private formatSummary(letter: LetterWithRelations) {
    return {
      id: letter.id,
      letterNumber: letter.letterNumber,
      type: letter.type,
      letterDate: letter.letterDate,
      subject: letter.subject,
      department: letter.department,
      priority: letter.priority,
      status: letter.status,
      sender: this.formatParty(letter.senderOurEntity, letter.senderPartner, letter.senderContact),
      receiver: this.formatParty(letter.receiverOurEntity, letter.receiverPartner, letter.receiverContact),
      issuingEntity: letter.issuingEntity,
      relatedInquiry: letter.relatedInquiry,
      relatedShipment: letter.relatedShipment,
      documentsCount: letter._count.documents,
      createdBy: letter.creator.fullName,
      createdAt: letter.createdAt,
      senderReferenceNumber: letter.senderReferenceNumber,
      responsibleUser: letter.responsibleUser,
      internalFromDepartment: letter.internalFromDepartment,
      internalToDepartment: letter.internalToDepartment,
      signers: letter.signers.map((s) => s.user),
    };
  }
}
