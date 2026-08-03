import { Type } from "class-transformer";
import {
  IsDateString,
  IsIn,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  MinLength,
} from "class-validator";

export const OUTCOME_MODES = ["won_all", "lost_all", "cancelled", "mixed"] as const;
export type OutcomeMode = (typeof OUTCOME_MODES)[number];

export const LOSS_REASONS = [
  "higher_price",
  "delivery_time",
  "technical_mismatch",
  "customer_requirement_change",
  "customer_project_cancelled",
  "other",
] as const;

export class SaveOutcomeDto {
  @IsIn(OUTCOME_MODES, { message: "حالت نتیجه نامعتبره" })
  mode!: OutcomeMode;

  @IsDateString()
  decisionDate!: string;

  @IsOptional()
  @IsString()
  winReason?: string;

  @IsOptional()
  @IsIn(LOSS_REASONS, { message: "دلیل باخت نامعتبره" })
  lossReason?: (typeof LOSS_REASONS)[number];

  @IsOptional()
  @IsString()
  competitorName?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  competitorPrice?: number;

  @IsOptional()
  @IsString()
  @MinLength(0)
  note?: string;

  /** الزامی فقط برای mode='mixed' — باید همه اقلام پرونده رو پوشش بده */
  @IsOptional()
  @IsObject()
  itemResults?: Record<string, "won" | "lost">;
}
