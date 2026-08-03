import { PrismaService } from "../prisma/prisma.service";
import { NotificationsService } from "../notifications/notifications.service";
import { ActivitiesScheduler } from "./activities.scheduler";

const ASSIGNEE_ID = "11111111-1111-1111-1111-111111111111";
const ACTIVITY_ID = "22222222-2222-2222-2222-222222222222";

function buildPrisma() {
  return {
    activity: { findMany: jest.fn(), update: jest.fn() },
  };
}

function buildScheduler(prisma: ReturnType<typeof buildPrisma>, alreadyNotified = false) {
  const notifications = {
    existsForEntity: jest.fn().mockResolvedValue(alreadyNotified),
    create: jest.fn().mockResolvedValue({}),
  };
  const scheduler = new ActivitiesScheduler(
    prisma as unknown as PrismaService,
    notifications as unknown as NotificationsService,
  );
  return { scheduler, notifications };
}

const DUE_ACTIVITY = {
  id: ACTIVITY_ID,
  subject: "تماس با فولاد مبارکه",
  status: "open",
  assignedToUserId: ASSIGNEE_ID,
  dueAt: new Date("2026-07-01T10:00:00Z"),
};

describe("ActivitiesScheduler", () => {
  it("flips a past-due open activity to overdue and notifies the assignee", async () => {
    const prisma = buildPrisma();
    prisma.activity.findMany.mockResolvedValue([DUE_ACTIVITY]);
    const { scheduler, notifications } = buildScheduler(prisma, false);

    await scheduler.handleOverdueActivities();

    expect(prisma.activity.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: ACTIVITY_ID }, data: expect.objectContaining({ status: "overdue" }) }),
    );
    expect(notifications.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: ASSIGNEE_ID,
        type: "activity_overdue",
        relatedEntityType: "activity",
        relatedEntityId: ACTIVITY_ID,
      }),
    );
  });

  it("does not create a duplicate notification if one already exists for this activity", async () => {
    const prisma = buildPrisma();
    prisma.activity.findMany.mockResolvedValue([DUE_ACTIVITY]);
    const { scheduler, notifications } = buildScheduler(prisma, true);

    await scheduler.handleOverdueActivities();

    expect(notifications.existsForEntity).toHaveBeenCalledWith("activity", ACTIVITY_ID, "activity_overdue");
    expect(notifications.create).not.toHaveBeenCalled();
  });

  it("only queries activities that are still open/scheduled/waiting and past due", async () => {
    const prisma = buildPrisma();
    prisma.activity.findMany.mockResolvedValue([]);
    const { scheduler } = buildScheduler(prisma);

    await scheduler.handleOverdueActivities();

    expect(prisma.activity.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: { in: ["open", "scheduled", "waiting"] } }),
      }),
    );
  });
});
