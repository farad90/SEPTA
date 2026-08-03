import { IsInt, IsNumber, IsUUID, Max, Min } from "class-validator";

export class SetLeaveBalanceDto {
  @IsUUID()
  leaveTypeId!: string;

  @IsInt()
  @Min(1900)
  @Max(2200)
  year!: number;

  @IsNumber()
  @Min(0)
  entitledDays!: number;
}
