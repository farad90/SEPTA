import { IsDateString, IsIn, IsOptional, IsString } from "class-validator";

export const ATTENDANCE_STATUSES = ["present", "absent", "on_leave", "holiday", "mission"] as const;

export class UpsertAttendanceDto {
  @IsDateString()
  workDate!: string;

  @IsIn(ATTENDANCE_STATUSES)
  status!: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class ListAttendanceQueryDto {
  @IsOptional()
  @IsString()
  month?: string;

  @IsOptional()
  @IsString()
  year?: string;
}
