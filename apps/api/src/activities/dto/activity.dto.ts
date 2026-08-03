import { IsDateString, IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength } from "class-validator";

export const ACTIVITY_TYPES = ["call", "email", "meeting", "follow_up", "reminder", "approval", "internal_task", "mention"] as const;
export const ACTIVITY_PRIORITIES = ["low", "normal", "high", "urgent"] as const;
// وضعیت‌های قابل تنظیم دستی از طریق PATCH — 'overdue' فقط توسط Cron، 'completed'/'cancelled' فقط از طریق endpoint مخصوص خودشون
// فاز ۳۱: 'in_progress' اضافه شد (طبق مرحلهٔ ۲ SPEC-PHASE-31 — بین 'open' و 'waiting'/'scheduled')
export const ACTIVITY_MANUAL_STATUSES = ["open", "in_progress", "scheduled", "waiting"] as const;

export class CreateActivityDto {
  @IsIn(ACTIVITY_TYPES, { message: "نوع فعالیت نامعتبره" })
  activityType!: (typeof ACTIVITY_TYPES)[number];

  @IsString()
  @MinLength(1, { message: "موضوع الزامیه" })
  @MaxLength(300)
  subject!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  relatedEntityType?: string;

  @IsOptional()
  @IsUUID()
  relatedEntityId?: string;

  @IsOptional()
  @IsIn(ACTIVITY_PRIORITIES, { message: "اولویت نامعتبره" })
  priority?: (typeof ACTIVITY_PRIORITIES)[number];

  @IsOptional()
  @IsDateString()
  scheduledAt?: string;

  @IsOptional()
  @IsDateString()
  dueAt?: string;

  @IsOptional()
  @IsUUID()
  assignedToUserId?: string;
}

export class UpdateActivityDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  subject?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsIn(ACTIVITY_PRIORITIES, { message: "اولویت نامعتبره" })
  priority?: (typeof ACTIVITY_PRIORITIES)[number];

  @IsOptional()
  @IsDateString()
  scheduledAt?: string;

  @IsOptional()
  @IsDateString()
  dueAt?: string;

  @IsOptional()
  @IsUUID()
  assignedToUserId?: string;

  @IsOptional()
  @IsIn(ACTIVITY_MANUAL_STATUSES, { message: "وضعیت نامعتبره" })
  status?: (typeof ACTIVITY_MANUAL_STATUSES)[number];

  // فاز ۳۱ — توضیح «منتظر چی/کی؟» وقتی status='waiting'
  @IsOptional()
  @IsString()
  @MaxLength(500)
  waitingReason?: string;
}

export class CompleteActivityDto {
  @IsOptional()
  @IsString()
  outcomeNote?: string;

  @IsOptional()
  @IsUUID()
  outcomeId?: string;
}

export class ListActivitiesQueryDto {
  @IsOptional()
  @IsString()
  assignedToMe?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  relatedEntityType?: string;

  @IsOptional()
  @IsUUID()
  relatedEntityId?: string;

  @IsOptional()
  @IsString()
  status?: string;
}
