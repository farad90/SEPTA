import { IsIn, IsOptional, IsString, IsUUID } from "class-validator";

export class UpdateUserDto {
  @IsOptional()
  @IsUUID()
  permissionGroupId?: string;

  @IsOptional()
  @IsIn(["active", "inactive"])
  status?: "active" | "inactive";

  // فاز ۵۱ — مدیر بتونه نام و شماره داخلی سایر کاربران رو از پنل ویرایش کنه
  @IsOptional()
  @IsString()
  fullName?: string;

  @IsOptional()
  @IsString()
  phone?: string;
}
