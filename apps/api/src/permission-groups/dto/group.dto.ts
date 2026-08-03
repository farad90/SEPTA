import { IsArray, IsOptional, IsString, MinLength } from "class-validator";

export class CreateGroupDto {
  @IsString()
  @MinLength(2, { message: "نام گروه الزامیه" })
  groupName!: string;

  /** لیست permission_key های تیک‌خورده */
  @IsArray()
  @IsString({ each: true })
  permissionKeys!: string[];
}

export class UpdateGroupDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  groupName?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  permissionKeys?: string[];
}
