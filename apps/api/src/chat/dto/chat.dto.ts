import { ArrayMinSize, ArrayUnique, IsArray, IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength } from "class-validator";

export class CreateConversationDto {
  @IsIn(["direct", "group"])
  conversationType!: "direct" | "group";

  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsUUID(undefined, { each: true })
  participantIds!: string[];

  @IsOptional()
  @IsString()
  @MaxLength(150)
  groupName?: string;
}

export class SendMessageDto {
  // فاز ۲۸ — پیام می‌تونه فقط متن، فقط پیوست، یا هردو باشه؛ اعتبارسنجی «حداقل یکی» در سرویس
  @IsOptional()
  @IsString()
  @MinLength(1)
  messageText?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  fileUrl?: string;
}

// فاز ۳۰ — ویرایش پیام: فقط متن/کپشن قابل تغییره، پیوست خودش دست‌نخورده می‌مونه
export class UpdateMessageDto {
  @IsString()
  @MinLength(1)
  messageText!: string;
}
