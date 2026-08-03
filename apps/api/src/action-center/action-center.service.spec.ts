import { ActionCenterService } from "./action-center.service";
import { ActionItem, ActionRuleProvider } from "./action-item.types";

function item(overrides: Partial<ActionItem>): ActionItem {
  return {
    id: "x",
    sourceType: "activity",
    sourceId: "x",
    source: "crm",
    kind: "task",
    title: "x",
    subtitle: null,
    priority: "normal",
    dueAt: null,
    isOverdue: false,
    origin: "mine",
    relatedEntityType: null,
    relatedEntityId: null,
    linkPath: null,
    actions: [],
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function fakeProvider(items: ActionItem[]): ActionRuleProvider {
  return { getItems: jest.fn().mockResolvedValue(items) };
}

describe("ActionCenterService", () => {
  it("merges items from every registered provider and sorts overdue-first, then by priority", async () => {
    const providerA = fakeProvider([item({ id: "a", priority: "low", isOverdue: false })]);
    const providerB = fakeProvider([
      item({ id: "b", priority: "urgent", isOverdue: true }),
      item({ id: "c", priority: "normal", isOverdue: false }),
    ]);
    const service = new ActionCenterService([providerA, providerB]);

    const result = await service.getForUser("user-1", "mine");

    expect(result.items.map((i) => i.id)).toEqual(["b", "c", "a"]);
    expect(providerA.getItems).toHaveBeenCalledWith("user-1", "mine");
    expect(providerB.getItems).toHaveBeenCalledWith("user-1", "mine");
  });

  it("builds the overdue/today/thisWeek/later summary from the merged items", async () => {
    const provider = fakeProvider([
      item({ id: "a", isOverdue: true }),
      item({ id: "b", isOverdue: false, dueAt: null }),
    ]);
    const service = new ActionCenterService([provider]);

    const result = await service.getForUser("user-1", "team");

    expect(result.summary.overdue).toBe(1);
    expect(result.summary.later).toBe(1);
  });

  it("returns an empty list when no provider is registered", async () => {
    const service = new ActionCenterService([]);
    const result = await service.getForUser("user-1", "mine");
    expect(result.items).toEqual([]);
  });
});
