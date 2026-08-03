import { IsIn, IsOptional, IsString, IsUUID, MinLength, ValidateIf } from "class-validator";

export class CreateBroadcastMessageDto {
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsString()
  @MinLength(1, { message: "متن پیام الزامیه" })
  message!: string;

  @IsIn(["user", "group", "all"])
  targetType!: "user" | "group" | "all";

  @ValidateIf((dto) => dto.targetType === "user")
  @IsUUID(undefined, { message: "انتخاب کاربر هدف الزامیه" })
  targetUserId?: string;

  @ValidateIf((dto) => dto.targetType === "group")
  @IsUUID(undefined, { message: "انتخاب گروه هدف الزامیه" })
  targetGroupId?: string;
}
