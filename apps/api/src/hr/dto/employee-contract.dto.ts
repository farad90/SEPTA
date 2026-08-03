import { IsDateString, IsIn, IsNumber, IsOptional, IsString, IsUUID, Min, MinLength } from "class-validator";

export const CONTRACT_TYPES = ["permanent", "fixed_term", "project_based", "probation"] as const;
export const CONTRACT_STATUSES = ["active", "expired", "terminated"] as const;

export class CreateContractDto {
  @IsUUID()
  ourEntityId!: string;

  @IsIn(CONTRACT_TYPES)
  contractType!: string;

  @IsOptional()
  @IsString()
  positionTitle?: string;

  @IsDateString()
  startDate!: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsNumber()
  @Min(0)
  baseSalary!: number;

  @IsString()
  @MinLength(3)
  salaryCurrency!: string;

  @IsOptional()
  @IsString()
  workLocation?: string;

  @IsOptional()
  @IsString()
  fileUrl?: string;

  @IsOptional()
  @IsDateString()
  signedDate?: string;
}

export class UpdateContractDto {
  @IsOptional()
  @IsIn(CONTRACT_TYPES)
  contractType?: string;

  @IsOptional()
  @IsString()
  positionTitle?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  baseSalary?: number;

  @IsOptional()
  @IsString()
  @MinLength(3)
  salaryCurrency?: string;

  @IsOptional()
  @IsString()
  workLocation?: string;

  @IsOptional()
  @IsIn(CONTRACT_STATUSES)
  status?: string;

  @IsOptional()
  @IsString()
  fileUrl?: string;

  @IsOptional()
  @IsDateString()
  signedDate?: string;
}
