import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "../../generated/prisma";
import { PrismaService } from "../prisma/prisma.service";
import { ActivityLogService } from "../inquiries/activity-log.service";
import { PermissionsService } from "../permissions/permissions.service";
import {
  CompleteActivityDto,
  CreateActivityDto,
  ListActivitiesQueryDto,
  UpdateActivityDto,
} from "./dto/activity.dto";
import { AddCommentDto, AddWatcherDto, ReassignTaskDto, RecordOutcomeDto } from "./dto/task-collaboration.dto";

const ACTIVITY_INCLUDE = {
  assignedTo: { select: { id: true, fullName: true } },
  createdBy: { select: { id: true, fullName: true } },
  outcome: { select: { id: true, label: true } },
} satisfies Prisma.ActivityInclude;

const TASK_DETAIL_INCLUDE = {
  ...ACTIVITY_INCLUDE,
  watchers: { include: { user: { select: { id: true, fullName: true } } } },
} satisfies Prisma.ActivityInclude;

const MANAGEMENT_GROUP_NAME = "مدیریت";
const TERMINAL_STATUSES = ["completed", "cancelled"];

/**
 * فاز ۱۶ — هستهٔ Activity (مرکز فعالیت‌ها). طبق SPEC-PHASE-16:
 * جایگزین ماژول Reminders سابقه، مکمل فید خودکار هر پرونده (ActivityLogService)
 * است نه جایگزینش. دسترسی بدون کلید RBAC جدید — طبق قواعد داخل همین سرویس.
 */
@Injectable()
export class ActivitiesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityLog: ActivityLogService,
    private readonly permissions: PermissionsService,
  ) {}

  async list(userId: string, query: ListActivitiesQueryDto) {
    const isManager = await this.canViewTeamActivities(userId);

    if (query.relatedEntityType) {
      await this.assertCanViewEntity(userId, query.relatedEntityType, query.relatedEntityId);
      return this.prisma.activity.findMany({
        where: {
          relatedEntityType: query.relatedEntityType,
          relatedEntityId: query.relatedEntityId,
          ...(query.status ? { status: query.status } : {}),
        },
        include: ACTIVITY_INCLUDE,
        orderBy: { createdAt: "desc" },
      });
    }

    const wantsMineOnly = query.assignedToMe === "true" || !isManager;
    return this.prisma.activity.findMany({
      where: {
        ...(wantsMineOnly
          ? { OR: [{ assignedToUserId: userId }, { createdByUserId: userId }] }
          : {}),
        ...(query.status ? { status: query.status } : {}),
      },
      include: ACTIVITY_INCLUDE,
      orderBy: [{ dueAt: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }],
    });
  }

  async create(dto: CreateActivityDto, currentUserId: string) {
    if (dto.relatedEntityType) {
      await this.assertEntityExists(dto.relatedEntityType, dto.relatedEntityId);
    }

    const ownerId = dto.assignedToUserId ?? currentUserId;

    const activity = await this.prisma.activity.create({
      data: {
        activityType: dto.activityType,
        subject: dto.subject,
        description: dto.description,
        relatedEntityType: dto.relatedEntityType,
        relatedEntityId: dto.relatedEntityId,
        priority: dto.priority ?? "normal",
        status: dto.scheduledAt ? "scheduled" : "open",
        scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : undefined,
        dueAt: dto.dueAt ? new Date(dto.dueAt) : undefined,
        assignedToUserId: ownerId,
        createdByUserId: currentUserId,
      },
      include: ACTIVITY_INCLUDE,
    });

    // Creator خودکار Watcher می‌شه — طبق طراحی UX تأییدشده («نباید نیاز به گزارش‌گیری باشه»)
    await this.prisma.taskWatcher.upsert({
      where: { taskId_userId: { taskId: activity.id, userId: currentUserId } },
      update: {},
      create: { taskId: activity.id, userId: currentUserId, addedByUserId: currentUserId },
    });

    const createdText =
      ownerId === currentUserId ? "کار را برای خودش ایجاد کرد" : `کار را ایجاد و به ${activity.assignedTo.fullName} واگذار کرد`;
    await this.addTimelineEntry(activity.id, currentUserId, "activity", createdText, "created");

    return activity;
  }

  async update(id: string, dto: UpdateActivityDto, currentUserId: string) {
    const activity = await this.getOrThrow(id);
    await this.assertCanEdit(activity, currentUserId);

    if (TERMINAL_STATUSES.includes(activity.status)) {
      throw new BadRequestException("فعالیت تکمیل/لغوشده قابل ویرایش نیست");
    }

    return this.prisma.activity.update({
      where: { id },
      data: {
        subject: dto.subject,
        description: dto.description,
        priority: dto.priority,
        scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : undefined,
        dueAt: dto.dueAt ? new Date(dto.dueAt) : undefined,
        assignedToUserId: dto.assignedToUserId,
        status: dto.status,
        // فاز ۳۱: وقتی وضعیت از 'waiting' خارج می‌شه، دلیل انتظار قبلی دیگه معنا نداره
        waitingReason: dto.status && dto.status !== "waiting" ? null : dto.waitingReason,
        updatedAt: new Date(),
      },
      include: ACTIVITY_INCLUDE,
    });
  }

  async complete(id: string, dto: CompleteActivityDto, currentUserId: string) {
    const activity = await this.getOrThrow(id);
    await this.assertCanEdit(activity, currentUserId);

    if (TERMINAL_STATUSES.includes(activity.status)) {
      throw new BadRequestException("این فعالیت قبلاً تکمیل/لغو شده");
    }

    const outcome = dto.outcomeId ? await this.getOutcomeOrThrow(dto.outcomeId, activity.activityType) : null;

    const updated = await this.prisma.activity.update({
      where: { id },
      data: {
        status: "completed",
        completedAt: new Date(),
        outcomeNote: dto.outcomeNote,
        outcomeId: dto.outcomeId,
        updatedAt: new Date(),
      },
      include: ACTIVITY_INCLUDE,
    });

    const isInquiryLinked = activity.relatedEntityType === "inquiry" && !!activity.relatedEntityId;

    if (isInquiryLinked) {
      const outcomeSuffix = outcome ? ` (نتیجه: ${outcome.label})` : "";
      await this.activityLog.log({
        inquiryId: activity.relatedEntityId!,
        authorId: currentUserId,
        text: dto.outcomeNote
          ? `فعالیت «${activity.subject}» تکمیل شد${outcomeSuffix} — ${dto.outcomeNote}`
          : `فعالیت «${activity.subject}» تکمیل شد${outcomeSuffix}`,
        tag: "stage_completed",
        metadata: { module: "activities", activityId: id, activityType: activity.activityType },
      });
    }

    // Auto Follow-up Engine (فاز ۱۷): اگه نتیجهٔ انتخاب‌شده نیاز به پیگیری داشته باشه،
    // فعالیت فعلی completed می‌مونه و یک فعالیت پیگیری جدید زنجیره‌شده ساخته می‌شه
    if (outcome?.requiresFollowUp) {
      const dueAt = new Date(Date.now() + (outcome.followUpOffsetMinutes ?? 0) * 60_000);
      const followUp = await this.prisma.activity.create({
        data: {
          activityType: outcome.followUpActivityType ?? activity.activityType,
          subject: `پیگیری: ${activity.subject}`,
          relatedEntityType: activity.relatedEntityType,
          relatedEntityId: activity.relatedEntityId,
          priority: activity.priority,
          status: "open",
          dueAt,
          assignedToUserId: activity.assignedToUserId,
          createdByUserId: currentUserId,
          followUpOfActivityId: activity.id,
        },
      });

      if (isInquiryLinked) {
        await this.activityLog.log({
          inquiryId: activity.relatedEntityId!,
          authorId: currentUserId,
          text: `فعالیت پیگیری خودکار «${followUp.subject}» ایجاد شد`,
          tag: "general",
          metadata: { module: "activities", activityId: followUp.id, followUpOf: activity.id },
        });
      }
    }

    return updated;
  }

  async cancel(id: string, currentUserId: string) {
    const activity = await this.getOrThrow(id);
    await this.assertCanEdit(activity, currentUserId);

    if (TERMINAL_STATUSES.includes(activity.status)) {
      throw new BadRequestException("این فعالیت قبلاً تکمیل/لغو شده");
    }

    return this.prisma.activity.update({
      where: { id },
      data: { status: "cancelled", updatedAt: new Date() },
      include: ACTIVITY_INCLUDE,
    });
  }

  // ------------------------------------------------------------
  // Work Management — Watcher/Timeline/ارجاع/ثبت نتیجهٔ ساختاریافته
  // ------------------------------------------------------------

  async getOne(id: string, currentUserId: string) {
    const activity = await this.prisma.activity.findUnique({ where: { id }, include: TASK_DETAIL_INCLUDE });
    if (!activity) {
      throw new NotFoundException("Task یافت نشد");
    }
    await this.assertCanView(activity, currentUserId);
    return activity;
  }

  async getTimeline(id: string, currentUserId: string) {
    const activity = await this.getOrThrow(id);
    await this.assertCanView(activity, currentUserId);

    return this.prisma.taskTimelineEntry.findMany({
      where: { taskId: id },
      include: { author: { select: { id: true, fullName: true } } },
      orderBy: { createdAt: "asc" },
    });
  }

  async addComment(id: string, dto: AddCommentDto, currentUserId: string) {
    const activity = await this.getOrThrow(id);
    await this.assertCanView(activity, currentUserId);

    return this.addTimelineEntry(id, currentUserId, "comment", dto.text);
  }

  async reassign(id: string, dto: ReassignTaskDto, currentUserId: string) {
    const activity = await this.getOrThrow(id);
    await this.assertCanEdit(activity, currentUserId);

    if (TERMINAL_STATUSES.includes(activity.status)) {
      throw new BadRequestException("فعالیت تکمیل/لغوشده قابل ارجاع نیست");
    }

    const newOwner = await this.prisma.user.findUnique({
      where: { id: dto.newOwnerId },
      select: { id: true, fullName: true },
    });
    if (!newOwner) {
      throw new NotFoundException("کاربر مقصد یافت نشد");
    }
    const previousOwner = await this.prisma.user.findUnique({
      where: { id: activity.assignedToUserId },
      select: { fullName: true },
    });

    const updated = await this.prisma.activity.update({
      where: { id },
      data: { assignedToUserId: dto.newOwnerId, updatedAt: new Date() },
      include: ACTIVITY_INCLUDE,
    });

    const text = dto.note
      ? `کار را از ${previousOwner?.fullName ?? "—"} به ${newOwner.fullName} ارجاع داد — ${dto.note}`
      : `کار را از ${previousOwner?.fullName ?? "—"} به ${newOwner.fullName} ارجاع داد`;
    await this.addTimelineEntry(id, currentUserId, "activity", text, "reassigned", {
      fromUserId: activity.assignedToUserId,
      toUserId: dto.newOwnerId,
    });

    return updated;
  }

  async addWatcher(id: string, dto: AddWatcherDto, currentUserId: string) {
    const activity = await this.getOrThrow(id);
    // دنبال‌کردن خودم همیشه آزاده (Self-subscribe)؛ افزودن شخص دیگه فقط مسئول/سازنده/مدیریت
    if (dto.userId !== currentUserId) {
      await this.assertCanEdit(activity, currentUserId);
    } else {
      await this.assertCanView(activity, currentUserId);
    }

    const watcher = await this.prisma.user.findUnique({ where: { id: dto.userId }, select: { fullName: true } });
    if (!watcher) {
      throw new NotFoundException("کاربر یافت نشد");
    }

    await this.prisma.taskWatcher.upsert({
      where: { taskId_userId: { taskId: id, userId: dto.userId } },
      update: {},
      create: { taskId: id, userId: dto.userId, addedByUserId: currentUserId },
    });

    await this.addTimelineEntry(
      id,
      currentUserId,
      "activity",
      dto.userId === currentUserId ? `${watcher.fullName} این کار را دنبال کرد` : `${watcher.fullName} را به‌عنوان دنبال‌کننده اضافه کرد`,
      "watcher_added",
      { userId: dto.userId },
    );

    return this.getOne(id, currentUserId);
  }

  async removeWatcher(id: string, watcherUserId: string, currentUserId: string) {
    const activity = await this.getOrThrow(id);
    if (watcherUserId !== currentUserId) {
      await this.assertCanEdit(activity, currentUserId);
    } else {
      await this.assertCanView(activity, currentUserId);
    }

    await this.prisma.taskWatcher.deleteMany({ where: { taskId: id, userId: watcherUserId } });
    return this.getOne(id, currentUserId);
  }

  /**
   * ثبت نتیجهٔ ساختاریافته — طبق طراحی UX تأییدشده: پیش‌فرض این نیست که Task
   * جدید ساخته بشه. وقتی اثر نتیجه create_follow_up باشه، همون Task با سررسید
   * جدید باز می‌مونه؛ فقط وقتی کاربر صراحتاً spawnNewTask=true بفرسته، این Task
   * بسته و یک Task مستقل زنجیره‌شده (الگوی قدیمی فاز ۱۷) ساخته می‌شه.
   */
  async recordOutcome(id: string, dto: RecordOutcomeDto, currentUserId: string) {
    const activity = await this.getOrThrow(id);
    await this.assertCanEdit(activity, currentUserId);

    if (TERMINAL_STATUSES.includes(activity.status)) {
      throw new BadRequestException("این فعالیت قبلاً تکمیل/لغو شده");
    }

    const outcome = dto.outcomeId ? await this.getOutcomeOrThrow(dto.outcomeId, activity.activityType) : null;
    const effect = dto.effectOverride ?? outcome?.effect ?? "close";
    const isInquiryLinked = activity.relatedEntityType === "inquiry" && !!activity.relatedEntityId;

    if (effect === "create_follow_up" && !dto.nextActionAt) {
      throw new BadRequestException("زمان اقدام بعدی برای این نتیجه الزامیه");
    }

    if (effect === "close") {
      const updated = await this.prisma.activity.update({
        where: { id },
        data: {
          status: "completed",
          completedAt: new Date(),
          outcomeNote: dto.outcomeNote,
          outcomeId: dto.outcomeId,
          updatedAt: new Date(),
        },
        include: ACTIVITY_INCLUDE,
      });
      await this.addTimelineEntry(id, currentUserId, "activity", outcome?.label ?? dto.outcomeNote ?? "انجام شد", "outcome_recorded", {
        outcomeLabel: outcome?.label ?? dto.outcomeNote ?? "انجام شد",
      });
      if (isInquiryLinked) {
        await this.activityLog.log({
          inquiryId: activity.relatedEntityId!,
          authorId: currentUserId,
          text: `فعالیت «${activity.subject}» تکمیل شد${outcome ? ` (نتیجه: ${outcome.label})` : ""}`,
          tag: "stage_completed",
          metadata: { module: "activities", activityId: id, activityType: activity.activityType },
        });
      }
      return updated;
    }

    if (effect === "keep_waiting") {
      const reason = dto.outcomeNote?.trim() || outcome?.label || "در انتظار پاسخ";
      const updated = await this.prisma.activity.update({
        where: { id },
        data: {
          status: "waiting",
          waitingReason: reason,
          outcomeNote: dto.outcomeNote,
          outcomeId: dto.outcomeId,
          updatedAt: new Date(),
        },
        include: ACTIVITY_INCLUDE,
      });
      await this.addTimelineEntry(id, currentUserId, "activity", outcome?.label ?? reason, "outcome_recorded", {
        outcomeLabel: outcome?.label ?? reason,
        waitingReason: reason,
      });
      return updated;
    }

    // effect === "create_follow_up"
    const nextActionAt = new Date(dto.nextActionAt!);

    if (!dto.spawnNewTask) {
      // پیش‌فرض — همین Task باز می‌مونه، فقط سررسید/اقدام بعدی به‌روز می‌شه
      const updated = await this.prisma.activity.update({
        where: { id },
        data: {
          status: activity.status === "waiting" ? "open" : activity.status,
          waitingReason: null,
          dueAt: nextActionAt,
          outcomeNote: dto.outcomeNote,
          outcomeId: dto.outcomeId,
          updatedAt: new Date(),
        },
        include: ACTIVITY_INCLUDE,
      });
      await this.addTimelineEntry(id, currentUserId, "activity", outcome?.label ?? dto.outcomeNote ?? "نیاز به پیگیری مجدد", "outcome_recorded", {
        outcomeLabel: outcome?.label ?? dto.outcomeNote ?? "نیاز به پیگیری مجدد",
        nextActionAt: nextActionAt.toISOString(),
        sameTask: true,
      });
      return updated;
    }

    // spawnNewTask=true — رفتار قدیمی فاز ۱۷: این Task بسته و یک Task مستقل زنجیره‌شده ساخته می‌شه
    const updated = await this.prisma.activity.update({
      where: { id },
      data: {
        status: "completed",
        completedAt: new Date(),
        outcomeNote: dto.outcomeNote,
        outcomeId: dto.outcomeId,
        updatedAt: new Date(),
      },
      include: ACTIVITY_INCLUDE,
    });

    const followUp = await this.prisma.activity.create({
      data: {
        activityType: outcome?.followUpActivityType ?? activity.activityType,
        subject: `پیگیری: ${activity.subject}`,
        relatedEntityType: activity.relatedEntityType,
        relatedEntityId: activity.relatedEntityId,
        priority: activity.priority,
        status: "open",
        dueAt: nextActionAt,
        assignedToUserId: activity.assignedToUserId,
        createdByUserId: currentUserId,
        followUpOfActivityId: activity.id,
      },
    });

    await this.addTimelineEntry(id, currentUserId, "activity", outcome?.label ?? dto.outcomeNote ?? "نیاز به پیگیری مجدد", "outcome_recorded", {
      outcomeLabel: outcome?.label ?? dto.outcomeNote ?? "نیاز به پیگیری مجدد",
      nextActionAt: nextActionAt.toISOString(),
      newTaskId: followUp.id,
    });

    if (isInquiryLinked) {
      await this.activityLog.log({
        inquiryId: activity.relatedEntityId!,
        authorId: currentUserId,
        text: `فعالیت پیگیری خودکار «${followUp.subject}» ایجاد شد`,
        tag: "general",
        metadata: { module: "activities", activityId: followUp.id, followUpOf: activity.id },
      });
    }

    return updated;
  }

  // ------------------------------------------------------------
  // Helpers
  // ------------------------------------------------------------

  private async getOrThrow(id: string) {
    const activity = await this.prisma.activity.findUnique({ where: { id } });
    if (!activity) {
      throw new NotFoundException("فعالیت یافت نشد");
    }
    return activity;
  }

  private async getOutcomeOrThrow(outcomeId: string, activityType: string) {
    const outcome = await this.prisma.activityOutcomeTemplate.findUnique({ where: { id: outcomeId } });
    if (!outcome) {
      throw new NotFoundException("قالب نتیجه یافت نشد");
    }
    if (outcome.activityType !== activityType) {
      throw new BadRequestException("این نتیجه برای نوع این فعالیت تعریف نشده");
    }
    return outcome;
  }

  private async assertCanEdit(
    activity: { id: string; assignedToUserId: string; createdByUserId: string },
    userId: string,
  ) {
    if (activity.assignedToUserId === userId || activity.createdByUserId === userId) return;
    if (await this.isManagementGroupMember(userId)) return;
    throw new ForbiddenException("فقط مسئول، سازنده یا مدیریت می‌تونن این فعالیت رو ویرایش کنن");
  }

  // مشاهده (کامنت/Timeline/جزئیات): مسئول، سازنده، دنبال‌کننده، مدیریت، یا دارندهٔ
  // action_center.view_team — طیف وسیع‌تر از assertCanEdit
  private async assertCanView(
    activity: { id: string; assignedToUserId: string; createdByUserId: string },
    userId: string,
  ) {
    if (activity.assignedToUserId === userId || activity.createdByUserId === userId) return;
    const watching = await this.prisma.taskWatcher.findUnique({
      where: { taskId_userId: { taskId: activity.id, userId } },
    });
    if (watching) return;
    if (await this.canViewTeamActivities(userId)) return;
    throw new ForbiddenException("دسترسی به این Task ندارید");
  }

  private async addTimelineEntry(
    taskId: string,
    authorId: string,
    entryType: "comment" | "activity",
    text: string,
    actionKind?: string,
    metadata?: Record<string, unknown>,
  ) {
    return this.prisma.taskTimelineEntry.create({
      data: {
        taskId,
        authorId,
        entryType,
        entryText: text,
        actionKind,
        metadata: metadata as Prisma.InputJsonValue | undefined,
      },
      include: { author: { select: { id: true, fullName: true } } },
    });
  }

  private async assertCanViewEntity(userId: string, relatedEntityType: string, relatedEntityId?: string) {
    if (relatedEntityType !== "inquiry") {
      throw new BadRequestException("نوع موجودیت پشتیبانی نمی‌شه");
    }
    if (!relatedEntityId) {
      throw new BadRequestException("relatedEntityId الزامیه");
    }
    const canView = await this.permissions.hasPermission(userId, "inquiry.view");
    if (!canView) {
      throw new ForbiddenException("دسترسی به این پرونده ندارید");
    }
  }

  private async assertEntityExists(relatedEntityType: string, relatedEntityId?: string) {
    if (relatedEntityType !== "inquiry") {
      throw new BadRequestException("نوع موجودیت پشتیبانی نمی‌شه");
    }
    if (!relatedEntityId) {
      throw new BadRequestException("relatedEntityId الزامیه");
    }
    const inquiry = await this.prisma.inquiry.findUnique({ where: { id: relatedEntityId } });
    if (!inquiry) {
      throw new NotFoundException("پروندهٔ استعلام یافت نشد");
    }
  }

  private async isManagementGroupMember(userId: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { permissionGroup: { select: { groupName: true } } },
    });
    return user?.permissionGroup?.groupName === MANAGEMENT_GROUP_NAME;
  }

  // فاز ۳۱ — طبق سؤال باز #۲ در SPEC-PHASE-31: در کنار گروه هارد-کدشدهٔ «مدیریت»،
  // دارندهٔ کلید دانه‌ریز action_center.view_team هم بتونه فعالیت‌های تیم رو ببینه
  // (فقط برای مشاهده — اختیار ویرایش همچنان فقط مسئول/سازنده/گروه مدیریته)
  private async canViewTeamActivities(userId: string): Promise<boolean> {
    if (await this.isManagementGroupMember(userId)) return true;
    return this.permissions.hasPermission(userId, "action_center.view_team");
  }
}
