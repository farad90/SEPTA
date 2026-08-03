import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { PermissionsService } from "../../permissions/permissions.service";
import { ActivitiesService } from "../../activities/activities.service";
import { ActionItem, ActionPriority, ActionRuleProvider, ActionSource } from "../action-item.types";
import { isOverdue } from "../action-item.utils";

const TERMINAL_ACTIVITY_STATUSES = ["completed", "cancelled"];

const ACTIVITY_KIND: Record<string, ActionItem["kind"]> = {
  call: "task",
  email: "task",
  meeting: "task",
  internal_task: "task",
  follow_up: "follow_up",
  reminder: "reminder",
  approval: "approval",
  mention: "mention",
};

const MANAGEMENT_GROUP_NAME = "مدیریت";

/** منبع #۱ — جدول activities موجود (هستهٔ Work Management: Task/Follow-up/Reminder/Approval/Mention) */
@Injectable()
export class ActivityRuleProvider implements ActionRuleProvider {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissions: PermissionsService,
    private readonly activities: ActivitiesService,
  ) {}

  async getItems(userId: string, scope: "mine" | "team"): Promise<ActionItem[]> {
    const wantsTeam = scope === "team" && (await this.canViewTeam(userId));
    const rows = await this.activities.list(userId, { assignedToMe: wantsTeam ? undefined : "true" });

    return rows
      .filter((a) => !TERMINAL_ACTIVITY_STATUSES.includes(a.status))
      .map((a) => {
        const dueAt = a.dueAt ? a.dueAt.toISOString() : null;
        const source: ActionSource = a.relatedEntityType === "inquiry" ? "inquiry" : "crm";
        return {
          id: `activity:${a.id}`,
          sourceType: "activity",
          sourceId: a.id,
          source,
          kind: ACTIVITY_KIND[a.activityType] ?? "task",
          title: a.subject,
          subtitle: a.description ?? null,
          priority: (a.priority as ActionPriority) ?? "normal",
          dueAt,
          isOverdue: isOverdue(dueAt),
          origin: a.assignedToUserId === a.createdByUserId ? "mine" : "assigned",
          relatedEntityType: a.relatedEntityType,
          relatedEntityId: a.relatedEntityId,
          linkPath: a.relatedEntityType === "inquiry" && a.relatedEntityId ? `/inquiries/${a.relatedEntityId}` : null,
          actions: [{ label: "تکمیل", method: "POST", path: `/activities/${a.id}/complete` }],
          createdAt: a.createdAt.toISOString(),
          ownerId: a.assignedToUserId,
          ownerName: a.assignedTo.fullName,
          creatorId: a.createdByUserId,
          creatorName: a.createdBy.fullName,
        } satisfies ActionItem;
      });
  }

  private async canViewTeam(userId: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { permissionGroup: { select: { groupName: true } } },
    });
    if (user?.permissionGroup?.groupName === MANAGEMENT_GROUP_NAME) return true;
    return this.permissions.hasPermission(userId, "action_center.view_team");
  }
}
