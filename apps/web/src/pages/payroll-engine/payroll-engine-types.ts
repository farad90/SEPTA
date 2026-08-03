export interface PayrollYear {
  id: string;
  yearNumber: number;
  calendarType: "jalali" | "gregorian";
  status: "open" | "closed";
  createdAt: string;
}

export interface PayrollRule {
  id: string;
  ruleVersionId: string;
  code: string;
  title: string;
  valueType: "number" | "percent" | "boolean";
  value: string;
  effectiveDate: string;
  expireDate: string | null;
  description: string | null;
}

export interface PayrollTaxBracket {
  id: string;
  ruleVersionId: string;
  bracketOrder: number;
  fromAmount: string;
  toAmount: string | null;
  ratePercent: string;
}

export interface PayrollFormula {
  id: string;
  ruleVersionId: string;
  code: string;
  expression: string;
  description: string | null;
}

export interface PayrollRuleVersion {
  id: string;
  payrollYearId: string;
  versionNumber: number;
  title: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  status: "draft" | "active" | "superseded";
  createdAt: string;
  rules?: PayrollRule[];
  brackets?: PayrollTaxBracket[];
  formulas?: PayrollFormula[];
}

export interface PayrollComponent {
  id: string;
  code: string;
  title: string;
  componentType: "earning" | "deduction";
  isInsurable: boolean;
  isTaxable: boolean;
  calcOrder: number;
  formulaId: string | null;
  formula?: PayrollFormula | null;
  status: "active" | "inactive";
}

export interface EmployeePayrollProfile {
  id: string;
  employeeId: string;
  seniorityBaseDate: string | null;
  childrenCount: number;
  insuranceNumber: string | null;
  costCenterDeptId: string | null;
  defaultRuleVersionId: string | null;
}

export interface PayrollPeriod {
  id: string;
  payrollYearId: string;
  periodCode: string;
  monthNumber: number;
  ruleVersionId: string;
  status: "open" | "closed";
  createdAt: string;
  payrollYear?: PayrollYear;
  ruleVersion?: PayrollRuleVersion;
}

export type PayrollResultStatus = "draft" | "calculated" | "reviewed" | "approved" | "posted" | "locked";

export interface PayrollResultItem {
  id: string;
  payrollResultId: string;
  componentId: string;
  componentCode: string;
  amount: string;
  calcOrder: number;
  formulaSnapshot: string | null;
  component?: PayrollComponent;
}

export interface PayrollResult {
  id: string;
  payrollPeriodId: string;
  employeeId: string;
  status: PayrollResultStatus;
  grossEarnings: string;
  totalDeductions: string;
  insuranceEmployeeShare: string;
  insuranceEmployerShare: string;
  unemploymentInsurance: string;
  taxAmount: string;
  netSalary: string;
  employerCost: string;
  calculatedAt: string | null;
  reviewedAt: string | null;
  approvedAt: string | null;
  postedAt: string | null;
  lockedAt: string | null;
  items?: PayrollResultItem[];
  employee?: { id: string; fullName: string; employeeNumber: string };
}

export interface PayrollCalculationOutcome {
  employeeId: string;
  status: "ok" | "error";
  resultId?: string;
  error?: string;
}
