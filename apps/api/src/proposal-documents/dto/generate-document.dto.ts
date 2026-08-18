import { IsIn, IsOptional, IsUUID } from "class-validator";

export class GenerateProposalDocumentDto {
  @IsIn(["pdf", "xlsx"], { message: "فرمت باید pdf یا xlsx باشه" })
  format!: "pdf" | "xlsx";

  @IsIn(["fa", "en"], { message: "زبان باید fa یا en باشه" })
  lang!: "fa" | "en";

  /** فاز ۶۰ — اگه پرشده باشه، سند فقط از داده‌ی همون گزینه‌ی ترم تحویل ساخته می‌شه */
  @IsOptional()
  @IsUUID()
  deliveryOptionId?: string;
}
