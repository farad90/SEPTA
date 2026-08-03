import { IsIn, IsString, MinLength } from "class-validator";

export const HR_REQUEST_TYPES = ["certificate", "salary_advance", "equipment", "other"] as const;

export class CreateHrRequestDto {
  @IsIn(HR_REQUEST_TYPES)
  requestType!: string;

  @IsString()
  @MinLength(1, { message: "توضیح الزامیه" })
  description!: string;
}
