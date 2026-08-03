export type FormulaNode =
  | { kind: "number"; value: number }
  | { kind: "identifier"; name: string }
  | { kind: "binary"; op: "+" | "-" | "*" | "/" | "%"; left: FormulaNode; right: FormulaNode }
  | { kind: "unary"; op: "-" | "!"; operand: FormulaNode }
  | { kind: "compare"; op: "==" | "!=" | ">" | ">=" | "<" | "<="; left: FormulaNode; right: FormulaNode }
  | { kind: "logical"; op: "AND" | "OR"; left: FormulaNode; right: FormulaNode }
  | { kind: "call"; name: string; args: FormulaNode[] };
