import { PrismaService } from "../../prisma/prisma.service";
import { PermissionsService } from "../../permissions/permissions.service";
import { ShipmentEditRuleProvider } from "./shipment-edit-rule.provider";

const USER_ID = "11111111-1111-1111-1111-111111111111";

function buildProvider() {
  const prisma = { shipmentEditRequest: { findMany: jest.fn().mockResolvedValue([]) } };
  const permissions = { hasPermission: jest.fn().mockResolvedValue(false) };
  const provider = new ShipmentEditRuleProvider(
    prisma as unknown as PrismaService,
    permissions as unknown as PermissionsService,
  );
  return { provider, prisma, permissions };
}

describe("ShipmentEditRuleProvider", () => {
  it("only includes pending shipment edit requests when the user holds shipping.approve_edit", async () => {
    const { provider, prisma, permissions } = buildProvider();
    prisma.shipmentEditRequest.findMany.mockResolvedValue([
      {
        id: "req-1",
        shipmentId: "ship-1",
        reason: "نیاز به اصلاح تاریخ بارگیری",
        createdAt: new Date(),
        shipment: { shipmentNumber: "SHP-2026-0001" },
        requester: { fullName: "سارا احمدی" },
      },
    ]);
    permissions.hasPermission.mockImplementation(async (_id: string, key: string) => key === "shipping.approve_edit");

    const items = await provider.getItems(USER_ID, "mine");

    expect(items).toHaveLength(1);
    expect(items[0].sourceType).toBe("shipment_edit_request");
    expect(items[0].source).toBe("shipping");
    expect(items[0].actions.map((a) => a.path)).toEqual([
      "/shipment-edit-requests/req-1/approve",
      "/shipment-edit-requests/req-1/reject",
    ]);
  });

  it("returns nothing without the permission", async () => {
    const { provider } = buildProvider();
    const items = await provider.getItems(USER_ID, "mine");
    expect(items).toHaveLength(0);
  });
});
