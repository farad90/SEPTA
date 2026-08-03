export interface ComponentDefinition {
  id: string;
  code: string;
  componentType: "earning" | "deduction";
  isInsurable: boolean;
  isTaxable: boolean;
  calcOrder: number;
  formulaExpression: string | null;
}

export interface ComponentEvaluationResult {
  componentId: string;
  code: string;
  componentType: "earning" | "deduction";
  isInsurable: boolean;
  isTaxable: boolean;
  calcOrder: number;
  amount: number;
  formulaSnapshot: string | null;
}
