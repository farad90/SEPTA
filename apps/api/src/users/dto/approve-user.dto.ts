import { IsUUID } from "class-validator";

export class ApproveUserDto {
  @IsUUID()
  permissionGroupId!: string;
}
