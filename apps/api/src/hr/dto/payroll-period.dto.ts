import { IsInt, IsUUID, Max, Min } from "class-validator";

export class CreatePayrollPeriodDto {
  @IsUUID()
  ourEntityId!: string;

  @IsInt()
  @Min(1)
  @Max(12)
  periodMonth!: number;

  @IsInt()
  @Min(1900)
  @Max(2200)
  periodYear!: number;
}
