import { IsString, MinLength } from "class-validator";

export class ResetPasswordDto {
  @IsString()
  token!: string;

  @IsString()
  @MinLength(8, { message: "رمز عبور جدید باید حداقل ۸ کاراکتر باشه" })
  newPassword!: string;
}
