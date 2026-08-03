export interface PayslipItemData {
  code: string;
  title: string;
  type: "earning" | "deduction";
  amount: number;
}

export interface PayslipDocumentData {
  resultId: string;
  periodCode: string;
  status: string;
  employeeName: string;
  employeeNumber: string;
  positionTitle: string | null;
  departmentName: string | null;
  ourEntity: {
    entityName: string;
    address: string | null;
    phone: string | null;
    email: string | null;
    logoUrl: string | null;
  } | null;
  currencyCode: string;
  items: PayslipItemData[];
  grossEarnings: number;
  insuranceEmployeeShare: number;
  insuranceEmployerShare: number;
  unemploymentInsurance: number;
  taxAmount: number;
  otherDeductions: number;
  totalDeductions: number;
  netSalary: number;
  employerCost: number;
}
