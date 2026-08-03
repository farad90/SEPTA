import { FormulaNode } from "./ast";
import { FormulaEvaluationError } from "./errors";

export type FormulaValue = number | boolean;
export type FormulaContext = Readonly<Record<string, FormulaValue>>;

function toNumber(v: FormulaValue, where: string): number {
  if (typeof v === "number") return v;
  throw new FormulaEvaluationError(`انتظار مقدار عددی در ${where} بود، مقدار boolean دریافت شد`);
}

function toBoolean(v: FormulaValue): boolean {
  if (typeof v === "boolean") return v;
  return v !== 0;
}

type FormulaFunction = (args: FormulaValue[]) => FormulaValue;

const FUNCTIONS: Record<string, FormulaFunction> = {
  IF: (args) => {
    if (args.length !== 3) {
      throw new FormulaEvaluationError("IF دقیقاً به ۳ آرگومان نیاز دارد: IF(شرط, آنگاه, وگرنه)");
    }
    return toBoolean(args[0]) ? args[1] : args[2];
  },
  MIN: (args) => {
    if (args.length === 0) throw new FormulaEvaluationError("MIN به حداقل یک آرگومان نیاز دارد");
    return Math.min(...args.map((a, i) => toNumber(a, `MIN آرگومان ${i + 1}`)));
  },
  MAX: (args) => {
    if (args.length === 0) throw new FormulaEvaluationError("MAX به حداقل یک آرگومان نیاز دارد");
    return Math.max(...args.map((a, i) => toNumber(a, `MAX آرگومان ${i + 1}`)));
  },
  ROUND: (args) => {
    if (args.length < 1 || args.length > 2) {
      throw new FormulaEvaluationError("ROUND به ۱ یا ۲ آرگومان نیاز دارد: ROUND(مقدار, رقم اعشار؟)");
    }
    const value = toNumber(args[0], "ROUND آرگومان ۱");
    const decimals = args.length > 1 ? toNumber(args[1], "ROUND آرگومان ۲") : 0;
    const factor = 10 ** decimals;
    return Math.round(value * factor) / factor;
  },
  FLOOR: (args) => Math.floor(toNumber(args[0], "FLOOR آرگومان ۱")),
  CEIL: (args) => Math.ceil(toNumber(args[0], "CEIL آرگومان ۱")),
  ABS: (args) => Math.abs(toNumber(args[0], "ABS آرگومان ۱")),
  PERCENT: (args) => {
    if (args.length !== 2) {
      throw new FormulaEvaluationError("PERCENT دقیقاً به ۲ آرگومان نیاز دارد: PERCENT(مقدار, درصد)");
    }
    const value = toNumber(args[0], "PERCENT آرگومان ۱");
    const pct = toNumber(args[1], "PERCENT آرگومان ۲");
    return (value * pct) / 100;
  },
};

export const FORMULA_FUNCTION_NAMES: ReadonlySet<string> = new Set(Object.keys(FUNCTIONS));

export class FormulaEvaluator {
  evaluate(node: FormulaNode, ctx: FormulaContext): FormulaValue {
    switch (node.kind) {
      case "number":
        return node.value;

      case "identifier": {
        const value = ctx[node.name];
        if (value === undefined) {
          throw new FormulaEvaluationError(`متغیر '${node.name}' در دسترس نیست`, node.name);
        }
        return value;
      }

      case "unary": {
        const operand = this.evaluate(node.operand, ctx);
        return node.op === "-" ? -toNumber(operand, "عملگر یکانی -") : !toBoolean(operand);
      }

      case "binary": {
        const left = toNumber(this.evaluate(node.left, ctx), `سمت چپ ${node.op}`);
        const right = toNumber(this.evaluate(node.right, ctx), `سمت راست ${node.op}`);
        switch (node.op) {
          case "+":
            return left + right;
          case "-":
            return left - right;
          case "*":
            return left * right;
          case "/":
            if (right === 0) throw new FormulaEvaluationError("تقسیم بر صفر");
            return left / right;
          case "%":
            if (right === 0) throw new FormulaEvaluationError("باقی‌مانده تقسیم بر صفر");
            return left % right;
        }
        break;
      }

      case "compare": {
        const left = toNumber(this.evaluate(node.left, ctx), `سمت چپ ${node.op}`);
        const right = toNumber(this.evaluate(node.right, ctx), `سمت راست ${node.op}`);
        switch (node.op) {
          case "==":
            return left === right;
          case "!=":
            return left !== right;
          case ">":
            return left > right;
          case ">=":
            return left >= right;
          case "<":
            return left < right;
          case "<=":
            return left <= right;
        }
        break;
      }

      case "logical": {
        const left = toBoolean(this.evaluate(node.left, ctx));
        if (node.op === "AND") return left && toBoolean(this.evaluate(node.right, ctx));
        return left || toBoolean(this.evaluate(node.right, ctx));
      }

      case "call": {
        const fn = FUNCTIONS[node.name];
        if (!fn) throw new FormulaEvaluationError(`تابع ناشناخته '${node.name}'`);
        const args = node.args.map((a) => this.evaluate(a, ctx));
        return fn(args);
      }
    }
    throw new FormulaEvaluationError("گره فرمول ناشناخته");
  }

  /** استخراج نام تمام متغیرها/فرمول‌های ارجاع‌شده — مبنای Dependency Engine (بدون نام توابع پیش‌ساخته) */
  extractDependencies(node: FormulaNode): string[] {
    const names = new Set<string>();
    const walk = (n: FormulaNode): void => {
      switch (n.kind) {
        case "number":
          break;
        case "identifier":
          names.add(n.name);
          break;
        case "unary":
          walk(n.operand);
          break;
        case "binary":
        case "compare":
        case "logical":
          walk(n.left);
          walk(n.right);
          break;
        case "call":
          n.args.forEach(walk);
          break;
      }
    };
    walk(node);
    return [...names];
  }
}
