import { IsIn, IsOptional, IsString, IsUUID, MinLength, ValidateIf } from "class-validator";

export class CreateDepartmentDto {
  @IsString()
  @MinLength(1, { message: "نام بخش الزامیه" })
  departmentName!: string;

  @IsOptional()
  @IsUUID()
  parentDepartmentId?: string;

  @IsUUID()
  ourEntityId!: string;
}

export class UpdateDepartmentDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  departmentName?: string;

  @IsOptional()
  @IsUUID()
  parentDepartmentId?: string;

  @IsOptional()
  @IsIn(["active", "inactive"])
  status?: string;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  headEmployeeId?: string | null;
}
