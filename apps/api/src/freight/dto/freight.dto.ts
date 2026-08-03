import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEmail,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Min,
  MinLength,
} from "class-validator";

export class CreateFreightRfqDto {
  @IsUUID(undefined, { message: "شرکت حمل الزامیه" })
  freightCompanyId!: string;

  @IsString()
  @MinLength(2, { message: "گمرک مقصد الزامیه" })
  destinationCustoms!: string;

  @IsArray()
  @ArrayMinSize(1, { message: "حداقل یک بسته لازمه" })
  @IsUUID(undefined, { each: true })
  packageIds!: string[];

  @IsEmail({}, { message: "ایمیل گیرنده معتبر نیست" })
  recipientEmail!: string;

  @IsOptional()
  @IsString()
  emailSubject?: string;
}

export class SaveFreightOfferDto {
  @IsNumber()
  @IsPositive({ message: "قیمت باید بزرگ‌تر از صفر باشه" })
  price!: number;

  @IsString()
  @MinLength(3)
  currencyCode!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  transitTimeDays?: number;

  @IsOptional()
  @IsDateString()
  offerDate?: string;

  @IsOptional()
  @IsDateString()
  validityDate?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
