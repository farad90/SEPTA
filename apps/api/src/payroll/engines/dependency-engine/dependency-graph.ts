import { CircularDependencyError } from "./errors";

/**
 * گراف جهت‌دار عمومی — گره‌ها کد Component هستند، یال از X به Y یعنی
 * «X باید قبل از Y محاسبه شود» (X پیش‌نیاز Y است).
 */
export class DependencyGraph {
  private readonly nodes = new Set<string>();
  private readonly edges = new Map<string, Set<string>>(); // node -> مجموعه‌ی گره‌هایی که به این گره وابسته‌اند (وابستگان)

  addNode(node: string): void {
    this.nodes.add(node);
    if (!this.edges.has(node)) this.edges.set(node, new Set());
  }

  /** from باید قبل از to محاسبه شود (from پیش‌نیاز to است) */
  addEdge(from: string, to: string): void {
    this.addNode(from);
    this.addNode(to);
    this.edges.get(from)!.add(to);
  }

  /** مرتب‌سازی توپولوژیک با الگوریتم Kahn — ترتیب صحیح محاسبه را برمی‌گرداند */
  topologicalOrder(): string[] {
    const inDegree = new Map<string, number>();
    for (const node of this.nodes) inDegree.set(node, 0);
    for (const [, targets] of this.edges) {
      for (const target of targets) {
        inDegree.set(target, (inDegree.get(target) ?? 0) + 1);
      }
    }

    const queue: string[] = [...this.nodes].filter((n) => inDegree.get(n) === 0).sort();
    const order: string[] = [];

    while (queue.length > 0) {
      const node = queue.shift()!;
      order.push(node);
      const newlyReady: string[] = [];
      for (const target of this.edges.get(node) ?? []) {
        const remaining = (inDegree.get(target) ?? 0) - 1;
        inDegree.set(target, remaining);
        if (remaining === 0) newlyReady.push(target);
      }
      queue.push(...newlyReady.sort());
    }

    if (order.length !== this.nodes.size) {
      const cycle = this.detectCycle();
      throw new CircularDependencyError(cycle ?? [...this.nodes]);
    }

    return order;
  }

  /** DFS برای یافتن مسیر کامل یک چرخه (برای گزارش خطای واضح) — null یعنی چرخه‌ای وجود ندارد */
  detectCycle(): string[] | null {
    const WHITE = 0;
    const GRAY = 1;
    const BLACK = 2;
    const color = new Map<string, number>();
    for (const node of this.nodes) color.set(node, WHITE);

    const path: string[] = [];

    const visit = (node: string): string[] | null => {
      color.set(node, GRAY);
      path.push(node);

      for (const target of this.edges.get(node) ?? []) {
        const targetColor = color.get(target);
        if (targetColor === GRAY) {
          const cycleStart = path.indexOf(target);
          return [...path.slice(cycleStart), target];
        }
        if (targetColor === WHITE) {
          const found = visit(target);
          if (found) return found;
        }
      }

      path.pop();
      color.set(node, BLACK);
      return null;
    };

    for (const node of this.nodes) {
      if (color.get(node) === WHITE) {
        const found = visit(node);
        if (found) return found;
      }
    }
    return null;
  }
}
