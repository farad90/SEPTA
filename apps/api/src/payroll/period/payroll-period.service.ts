import { Injectable, NotFoundException } from "@nestjs/common";
import { mapPayrollDomainError } from "../payroll-domain-error.mapper";
import { PayrollProcessorService } from "../pipeline/payroll-processor.service";
import { PayrollPeriodRepository } from "../repositories/payroll-period.repository";
import { PayrollResultRepository } from "../repositories/payroll-result.repository";
import { WorkLogAggregatorService } from "../worklog/worklog-aggregator.service";
import { CreatePayrollPeriodDto, ManualWorkLogDto } from "../dto/payroll-period.dto";

@Injectable()
export class PayrollPeriodService {
  constructor(
    private readonly periodRepository: PayrollPeriodRepository,
    private readonly resultRepository: PayrollResultRepository,
    private readonly workLogAggregator: WorkLogAggregatorService,
    private readonly processor: PayrollProcessorService,
  ) {}

  listByYear(payrollYearId: string) {
    return this.periodRepository.listByYear(payrollYearId);
  }

  async getById(id: string) {
    const period = await this.periodRepository.findById(id);
    if (!period) throw new NotFoundException("دوره‌ی حقوقی یافت نشد");
    return period;
  }

  createPeriod(dto: CreatePayrollPeriodDto) {
    return this.periodRepository.create(dto);
  }

  aggregateWorkLog(payrollPeriodId: string) {
    return this.workLogAggregator.aggregateForPeriod(payrollPeriodId).catch(mapPayrollDomainError);
  }

  setManualWorkLog(payrollPeriodId: string, employeeId: string, dto: ManualWorkLogDto) {
    return this.workLogAggregator.setManualOverride(payrollPeriodId, employeeId, dto);
  }

  calculateForEmployee(payrollPeriodId: string, employeeId: string) {
    return this.processor.calculateForEmployee(payrollPeriodId, employeeId).catch(mapPayrollDomainError);
  }

  // دسته‌جمعی: هر کارمند مستقل catch می‌شود (نگاه کنید به PayrollProcessorService.calculateForPeriod)،
  // پس اینجا نیازی به ترجمه‌ی خطای HTTP نیست — فقط اگر خود period پیدا نشود ممکنه خطا بده که همان درسته.
  calculateForPeriod(payrollPeriodId: string) {
    return this.processor.calculateForPeriod(payrollPeriodId);
  }

  listResults(payrollPeriodId: string) {
    return this.resultRepository.listByPeriod(payrollPeriodId);
  }

  async getResult(resultId: string) {
    const result = await this.resultRepository.findById(resultId);
    if (!result) throw new NotFoundException("نتیجه‌ی حقوق یافت نشد");
    return result;
  }
}
