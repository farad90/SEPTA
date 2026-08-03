import { Injectable, NotFoundException } from "@nestjs/common";
import { PayrollResultRepository } from "../repositories/payroll-result.repository";
import { PayslipDocumentData } from "./payslip-document-data.type";

const ENGINE_MANAGED_CODES = new Set(["INSURANCE", "TAX"]);

@Injectable()
export class PayslipDataService {
  constructor(private readonly resultRepository: PayrollResultRepository) {}

  async getPayslipData(resultId: string): Promise<PayslipDocumentData> {
    const result = await this.resultRepository.findByIdForDocument(resultId);
    if (!result) throw new NotFoundException("نتیجه‌ی حقوق یافت نشد");

    return {
      resultId: result.id,
      periodCode: result.payrollPeriod.periodCode,
      status: result.status,
      employeeName: result.employee.fullName,
      // پرسنل بدون شماره پرسنلی وارد چرخه حقوق و دستمزد نمی‌شن، پس این عملاً همیشه پره
      employeeNumber: result.employee.employeeNumber ?? "",
      positionTitle: result.employee.positionTitle,
      departmentName: result.employee.department?.departmentName ?? null,
      ourEntity: result.employee.ourEntity
        ? {
            entityName: result.employee.ourEntity.entityName,
            address: result.employee.ourEntity.address,
            phone: result.employee.ourEntity.phone,
            email: result.employee.ourEntity.email,
            logoUrl: result.employee.ourEntity.logoUrl,
          }
        : null,
      currencyCode: result.employee.contracts[0]?.salaryCurrency ?? "IRR",
      items: result.items
        .filter((item) => !ENGINE_MANAGED_CODES.has(item.componentCode))
        .map((item) => ({
          code: item.componentCode,
          title: item.component.title,
          type: item.component.componentType as "earning" | "deduction",
          amount: Number(item.amount),
        })),
      grossEarnings: Number(result.grossEarnings),
      insuranceEmployeeShare: Number(result.insuranceEmployeeShare),
      insuranceEmployerShare: Number(result.insuranceEmployerShare),
      unemploymentInsurance: Number(result.unemploymentInsurance),
      taxAmount: Number(result.taxAmount),
      otherDeductions:
        Number(result.totalDeductions) - Number(result.insuranceEmployeeShare) - Number(result.taxAmount),
      totalDeductions: Number(result.totalDeductions),
      netSalary: Number(result.netSalary),
      employerCost: Number(result.employerCost),
    };
  }
}
