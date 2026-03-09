import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class UploadLogoDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(600)
  url: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(200)
  title: string;

  // Description is optional so the frontend can submit null or skip the field.
  @IsOptional()
  @IsString()
  @MaxLength(400)
  description?: string | null;

  @IsNotEmpty()
  @IsString()
  @MaxLength(600)
  link: string;
}
