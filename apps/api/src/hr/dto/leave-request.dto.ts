import { IsDateString, IsOptional, IsString, IsUUID } from "class-validator";

export class CreateLeaveRequestDto {
  @IsUUID()
  leaveTypeId!: string;

  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsString()
  attachmentFileUrl?: string;
}
