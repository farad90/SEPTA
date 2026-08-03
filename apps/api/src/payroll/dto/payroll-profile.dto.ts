import { IsDateString, IsOptional, IsString, IsUUID } from "class-validator";

// ⚠️ childrenCount عمداً اینجا نیست — فاز ۴۲ آن را با EmployeeChild (تاریخ تولد، سقف سنی
// از Rule) جایگزین کرد؛ ستون در دیتابیس برای Rollback باقی مانده ولی دیگر از این مسیر نوشته نمی‌شود.
export class UpsertPayrollProfileDto {
  @IsOptional()
  @IsDateString()
  seniorityBaseDate?: string;

  @IsOptional()
  @IsString()
  insuranceNumber?: string;

  @IsOptional()
  @IsUUID()
  costCenterDeptId?: string;

  @IsOptional()
  @IsUUID()
  defaultRuleVersionId?: string;
}
