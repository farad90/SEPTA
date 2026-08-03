import { IsDateString, IsOptional, IsString } from "class-validator";

export class CreateEmployeeChildDto {
  @IsOptional()
  @IsString()
  fullName?: string;

  @IsDateString()
  birthDate!: string;
}
