import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { PermissionsService } from "../../permissions/permissions.service";
import { ActionItem, ActionRuleProvider } from "../action-item.types";

/** منبع #۳ — درخواست اصلاح مرحلهٔ قفل‌شدهٔ محموله (فاز ۲۷) */
@Injectable()
export class ShipmentEditRuleProvider implements ActionRuleProvider {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissions: PermissionsService,
  ) {}

  async getItems(userId: string, _scope?: "mine" | "team"): Promise<ActionItem[]> {
    const canApprove = await this.permissions.hasPermission(userId, "shipping.approve_edit");
    if (!canApprove) return [];

    const requests = await this.prisma.shipmentEditRequest.findMany({
      where: { status: "pending" },
      include: { shipment: { select: { shipmentNumber: true } }, requester: { select: { fullName: true } } },
      orderBy: { createdAt: "asc" },
    });

    return requests.map((r) => ({
      id: `shipment_edit_request:${r.id}`,
      sourceType: "shipment_edit_request",
      sourceId: r.id,
      source: "shipping",
      kind: "approval",
      title: `درخواست اصلاح محموله ${r.shipment.shipmentNumber}`,
      subtitle: `${r.requester.fullName}: ${r.reason}`,
      priority: "high",
      dueAt: null,
      isOverdue: false,
      origin: "assigned",
      relatedEntityType: "shipment",
      relatedEntityId: r.shipmentId,
      linkPath: "/shipments",
      actions: [
        { label: "تأیید", method: "POST", path: `/shipment-edit-requests/${r.id}/approve` },
        { label: "رد", method: "POST", path: `/shipment-edit-requests/${r.id}/reject` },
      ],
      createdAt: r.createdAt.toISOString(),
    }));
  }
}
