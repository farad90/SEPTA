import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { ActivityLogService } from "../inquiries/activity-log.service";
import { PermissionsService } from "../permissions/permissions.service";
import { ActivitiesService } from "./activities.service";

const USER_ID = "11111111-1111-1111-1111-111111111111";
const OTHER_USER_ID = "22222222-2222-2222-2222-222222222222";
const INQUIRY_ID = "33333333-3333-3333-3333-333333333333";
const ACTIVITY_ID = "44444444-4444-4444-4444-444444444444";

function buildPrisma() {
  return {
    activity: { findMany: jest.fn(), create: jest.fn(), update: jest.fn(), findUnique: jest.fn() },
    activityOutcomeTemplate: { findUnique: jest.fn() },
    inquiry: { findUnique: jest.fn() },
    user: { findUnique: jest.fn() },
  };
}

function buildService(prisma: ReturnType<typeof buildPrisma>) {
  const activityLog = { log: jest.fn().mockResolvedValue({}) };
  const permissions = { hasPermission: jest.fn().mockResolvedValue(true) };
  const service = new ActivitiesService(
    prisma as unknown as PrismaService,
    activityLog as unknown as ActivityLogService,
    permissions as unknown as PermissionsService,
  );
  return { service, activityLog, permissions };
}

const BASE_ACTIVITY = {
  id: ACTIVITY_ID,
  activityType: "follow_up",
  subject: "پیگیری قیمت",
  status: "open",
  assignedToUserId: USER_ID,
  createdByUserId: USER_ID,
  relatedEntityType: "inquiry",
  relatedEntityId: INQUIRY_ID,
};

describe("ActivitiesService", () => {
  it("rejects creating an activity linked to a non-existent inquiry", async () => {
    const prisma = buildPrisma();
    prisma.inquiry.findUnique.mockResolvedValue(null);
    const { service } = buildService(prisma);

    await expect(
      service.create(
        { activityType: "call", subject: "تست", relatedEntityType: "inquiry", relatedEntityId: INQUIRY_ID },
        USER_ID,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("requires inquiry.view permission to list a timeline for an inquiry", async () => {
    const prisma = buildPrisma();
    const { service, permissions } = buildService(prisma);
    permissions.hasPermission.mockResolvedValue(false);
    prisma.user.findUnique.mockResolvedValue({ permissionGroup: { groupName: "فروش" } });

    await expect(
      service.list(USER_ID, { relatedEntityType: "inquiry", relatedEntityId: INQUIRY_ID } as never),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("لیست همه فعالیت‌ها رو به دارندهٔ action_center.view_team هم می‌ده، نه فقط عضو گروه مدیریت (فاز ۳۱)", async () => {
    const prisma = buildPrisma();
    prisma.user.findUnique.mockResolvedValue({ permissionGroup: { groupName: "فروش" } });
    prisma.activity.findMany.mockResolvedValue([]);
    const { service, permissions } = buildService(prisma);
    permissions.hasPermission.mockImplementation(async (_id: string, key: string) => key === "action_center.view_team");

    await service.list(USER_ID, {} as never);

    expect(prisma.activity.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.not.objectContaining({ OR: expect.anything() }) }),
    );
  });

  it("waitingReason پاک می‌شه وقتی وضعیت از 'waiting' به وضعیت دیگه‌ای تغییر می‌کنه (فاز ۳۱)", async () => {
    const prisma = buildPrisma();
    prisma.activity.findUnique.mockResolvedValue({ ...BASE_ACTIVITY, status: "waiting" });
    prisma.activity.update.mockResolvedValue({ ...BASE_ACTIVITY, status: "open" });
    const { service } = buildService(prisma);

    await service.update(ACTIVITY_ID, { status: "open", waitingReason: "قدیمی — نباید ذخیره بشه" }, USER_ID);

    expect(prisma.activity.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ waitingReason: null }) }),
    );
  });

  it("rejects editing an activity you don't own, didn't create, and aren't management for", async () => {
    const prisma = buildPrisma();
    prisma.activity.findUnique.mockResolvedValue(BASE_ACTIVITY);
    prisma.user.findUnique.mockResolvedValue({ permissionGroup: { groupName: "فروش" } });
    const { service } = buildService(prisma);

    await expect(service.update(ACTIVITY_ID, { subject: "تغییر" }, OTHER_USER_ID)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it("allows a member of the مدیریت group to edit someone else's activity", async () => {
    const prisma = buildPrisma();
    prisma.activity.findUnique.mockResolvedValue(BASE_ACTIVITY);
    prisma.user.findUnique.mockResolvedValue({ permissionGroup: { groupName: "مدیریت" } });
    prisma.activity.update.mockResolvedValue({ ...BASE_ACTIVITY, subject: "تغییر" });
    const { service } = buildService(prisma);

    await service.update(ACTIVITY_ID, { subject: "تغییر" }, OTHER_USER_ID);

    expect(prisma.activity.update).toHaveBeenCalled();
  });

  it("logs into the inquiry's discussion feed when completing an inquiry-linked activity", async () => {
    const prisma = buildPrisma();
    prisma.activity.findUnique.mockResolvedValue(BASE_ACTIVITY);
    prisma.activity.update.mockResolvedValue({ ...BASE_ACTIVITY, status: "completed" });
    const { service, activityLog } = buildService(prisma);

    await service.complete(ACTIVITY_ID, { outcomeNote: "انجام شد" }, USER_ID);

    expect(activityLog.log).toHaveBeenCalledWith(
      expect.objectContaining({ inquiryId: INQUIRY_ID, tag: "stage_completed" }),
    );
  });

  it("rejects completing an already-completed activity", async () => {
    const prisma = buildPrisma();
    prisma.activity.findUnique.mockResolvedValue({ ...BASE_ACTIVITY, status: "completed" });
    const { service } = buildService(prisma);

    await expect(service.complete(ACTIVITY_ID, {}, USER_ID)).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects cancelling an already-cancelled activity", async () => {
    const prisma = buildPrisma();
    prisma.activity.findUnique.mockResolvedValue({ ...BASE_ACTIVITY, status: "cancelled" });
    const { service } = buildService(prisma);

    await expect(service.cancel(ACTIVITY_ID, USER_ID)).rejects.toBeInstanceOf(BadRequestException);
  });

  describe("Auto Follow-up Engine (فاز ۱۷)", () => {
    const OUTCOME_ID = "55555555-5555-5555-5555-555555555555";

    it("creates a chained follow-up activity when the chosen outcome requires follow-up", async () => {
      const prisma = buildPrisma();
      prisma.activity.findUnique.mockResolvedValue(BASE_ACTIVITY);
      prisma.activity.update.mockResolvedValue({ ...BASE_ACTIVITY, status: "completed", outcomeId: OUTCOME_ID });
      prisma.activityOutcomeTemplate.findUnique.mockResolvedValue({
        id: OUTCOME_ID,
        activityType: "follow_up",
        label: "منتظر تأمین‌کننده",
        requiresFollowUp: true,
        followUpActivityType: null,
        followUpOffsetMinutes: 180,
      });
      prisma.activity.create.mockResolvedValue({ id: "new-followup-id", subject: "پیگیری: پیگیری قیمت" });
      const { service } = buildService(prisma);

      await service.complete(ACTIVITY_ID, { outcomeId: OUTCOME_ID }, USER_ID);

      expect(prisma.activity.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            activityType: "follow_up",
            followUpOfActivityId: ACTIVITY_ID,
            assignedToUserId: BASE_ACTIVITY.assignedToUserId,
            relatedEntityType: "inquiry",
            relatedEntityId: INQUIRY_ID,
          }),
        }),
      );
    });

    it("does not create a follow-up activity when the chosen outcome does not require one", async () => {
      const prisma = buildPrisma();
      prisma.activity.findUnique.mockResolvedValue(BASE_ACTIVITY);
      prisma.activity.update.mockResolvedValue({ ...BASE_ACTIVITY, status: "completed" });
      prisma.activityOutcomeTemplate.findUnique.mockResolvedValue({
        id: OUTCOME_ID,
        activityType: "follow_up",
        label: "نتیجه گرفته شد",
        requiresFollowUp: false,
        followUpActivityType: null,
        followUpOffsetMinutes: null,
      });
      const { service } = buildService(prisma);

      await service.complete(ACTIVITY_ID, { outcomeId: OUTCOME_ID }, USER_ID);

      expect(prisma.activity.create).not.toHaveBeenCalled();
    });

    it("rejects an outcome template whose activityType doesn't match the activity being completed", async () => {
      const prisma = buildPrisma();
      prisma.activity.findUnique.mockResolvedValue(BASE_ACTIVITY);
      prisma.activityOutcomeTemplate.findUnique.mockResolvedValue({
        id: OUTCOME_ID,
        activityType: "call",
        label: "بی‌پاسخ",
        requiresFollowUp: true,
        followUpOffsetMinutes: 60,
      });
      const { service } = buildService(prisma);

      await expect(service.complete(ACTIVITY_ID, { outcomeId: OUTCOME_ID }, USER_ID)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it("rejects a non-existent outcome template", async () => {
      const prisma = buildPrisma();
      prisma.activity.findUnique.mockResolvedValue(BASE_ACTIVITY);
      prisma.activityOutcomeTemplate.findUnique.mockResolvedValue(null);
      const { service } = buildService(prisma);

      await expect(service.complete(ACTIVITY_ID, { outcomeId: OUTCOME_ID }, USER_ID)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
