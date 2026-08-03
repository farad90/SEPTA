import { IsDateString, IsString, MinLength } from "class-validator";

export class CreatePerformanceReviewCycleDto {
  @IsString()
  @MinLength(1, { message: "نام دوره الزامیه" })
  cycleName!: string;

  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;
}
