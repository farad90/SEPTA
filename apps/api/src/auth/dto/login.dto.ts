import { IsString, MinLength } from "class-validator";

export class LoginDto {
  /** موبایل یا ایمیل */
  @IsString()
  @MinLength(3)
  identifier!: string;

  @IsString()
  @MinLength(1)
  password!: string;
}
