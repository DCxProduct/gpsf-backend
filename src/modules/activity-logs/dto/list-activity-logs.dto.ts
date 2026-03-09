import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

const toOptionalNumber = ({ value }: { value: unknown }) => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : value;
};

const toOptionalString = ({ value }: { value: unknown }) => {
  if (value === undefined || value === null) {
    return undefined;
  }

  const normalized = String(value).trim();
  return normalized.length > 0 ? normalized : undefined;
};

export class ListActivityLogsDto {
  @IsOptional()
  @Transform(toOptionalNumber)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Transform(toOptionalNumber)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @Transform(toOptionalString)
  @IsString()
  kind?: string;

  @IsOptional()
  @Transform(toOptionalString)
  @IsString()
  module?: string;

  @IsOptional()
  @Transform(toOptionalNumber)
  @IsInt()
  @Min(1)
  actorId?: number;

  @IsOptional()
  @Transform(toOptionalString)
  @IsString()
  q?: string;

  @IsOptional()
  @Transform(toOptionalString)
  @IsString()
  from?: string;

  @IsOptional()
  @Transform(toOptionalString)
  @IsString()
  to?: string;

  @IsOptional()
  @Transform(toOptionalString)
  @IsIn(['ASC', 'DESC', 'asc', 'desc'])
  order?: 'ASC' | 'DESC' | 'asc' | 'desc';
}
