import { PrismaService } from "../../prisma/prisma.service";
import { PermissionsService } from "../../permissions/permissions.service";
import { ActivitiesService } from "../../activities/activities.service";
import { ActivityRuleProvider } from "./activity-rule.provider";

const USER_ID = "11111111-1111-1111-1111-111111111111";

function buildProvider() {
  const prisma = { user: { findUnique: jest.fn().mockResolvedValue({ permissionGroup: { groupName: "فروش" } }) } };
  const permissions = { hasPermission: jest.fn().mockResolvedValue(false) };
  const activities = { list: jest.fn().mockResolvedValue([]) };
  const provider = new ActivityRuleProvider(
    prisma as unknown as PrismaService,
    permissions as unknown as PermissionsService,
    activities as unknown as ActivitiesService,
  );
  return { provider, prisma, permissions, activities };
}

describe("ActivityRuleProvider", () => {
  it("maps open activities into ActionItems and filters out terminal statuses", async () => {
    const { provider, activities } = buildProvider();
    activities.list.mockResolvedValue([
      {
        id: "act-1",
        activityType: "follow_up",
        subject: "پیگیری قیمت",
        description: null,
        priority: "high",
        status: "open",
        dueAt: new Date(Date.now() - 86_400_000), // دیروز — سررسیدگذشته
        assignedToUserId: USER_ID,
        createdByUserId: USER_ID,
        relatedEntityType: "inquiry",
        relatedEntityId: "inq-1",
        createdAt: new Date(),
        assignedTo: { fullName: "فرشید" },
        createdBy: { fullName: "فرشید" },
      },
      {
        id: "act-2",
        activityType: "internal_task",
        subject: "قدیمی",
        description: null,
        priority: "low",
        status: "completed",
        dueAt: null,
        assignedToUserId: USER_ID,
        createdByUserId: USER_ID,
        relatedEntityType: null,
        relatedEntityId: null,
        createdAt: new Date(),
        assignedTo: { fullName: "فرشید" },
        createdBy: { fullName: "فرشید" },
      },
    ]);

    const items = await provider.getItems(USER_ID, "mine");

    expect(items).toHaveLength(1);
    expect(items[0].sourceType).toBe("activity");
    expect(items[0].source).toBe("inquiry");
    expect(items[0].isOverdue).toBe(true);
    expect(items[0].linkPath).toBe("/inquiries/inq-1");
  });

  it("passes assignedToMe=true when scope=mine or the user can't view the team", async () => {
    const { provider, activities } = buildProvider();
    await provider.getItems(USER_ID, "mine");
    expect(activities.list).toHaveBeenCalledWith(USER_ID, { assignedToMe: "true" });
  });
});
