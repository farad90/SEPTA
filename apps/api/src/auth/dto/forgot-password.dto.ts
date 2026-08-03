import { IsNotEmpty, IsString } from "class-validator";

export class ForgotPasswordDto {
  @IsString()
  @IsNotEmpty({ message: "موبایل یا ایمیل الزامیه" })
  identifier!: string;
}
