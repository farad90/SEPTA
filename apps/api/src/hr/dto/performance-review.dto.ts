import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";

export class ReviewCriterionDto {
  @IsString()
  @MinLength(1, { message: "نام معیار الزامیه" })
  criterionName!: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  weightPercent?: number;
}

export class CreatePerformanceReviewDto {
  @IsUUID()
  cycleId!: string;

  @IsUUID()
  employeeId!: string;

  @IsUUID()
  reviewerId!: string;

  @IsArray()
  @ArrayMinSize(1, { message: "حداقل یک معیار لازمه" })
  @ValidateNested({ each: true })
  @Type(() => ReviewCriterionDto)
  criteria!: ReviewCriterionDto[];
}

export class SelfReviewDto {
  @IsString()
  selfReviewNotes!: string;
}

export class ReviewItemScoreDto {
  @IsUUID()
  id!: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  score?: number;

  @IsOptional()
  @IsString()
  comments?: string;
}

export class SubmitReviewDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  overallScore?: number;

  @IsOptional()
  @IsString()
  managerNotes?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReviewItemScoreDto)
  items!: ReviewItemScoreDto[];
}

export class UpdatePerformanceReviewDto {
  @IsOptional()
  @IsUUID()
  reviewerId?: string;

  @IsOptional()
  @IsString()
  selfReviewNotes?: string;

  @IsOptional()
  @IsString()
  managerNotes?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  overallScore?: number;

  @IsOptional()
  @IsString()
  status?: string;
}
