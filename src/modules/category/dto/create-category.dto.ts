import { IsArray, IsInt, IsNotEmpty, IsObject, IsOptional, Max, Min } from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class CreateCategoryDto {
  @IsObject()
  @IsNotEmpty()
  name: {
    en: string;
    km?: string;
  };

  @IsOptional()
  @IsObject()
  description?: {
    en: string;
    km?: string;
  };

  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === '') {
      return undefined;
    }
    const raw = Array.isArray(value) ? value : String(value).split(',');
    return raw
      .map((item) => Number(String(item).trim()))
      .filter((item) => Number.isInteger(item) && item > 0);
  })
  @IsArray()
  @Type(() => Number)
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(2147483647, { each: true })
  pageIds?: number[];
};

