import { IsNumber, IsPositive, IsString } from 'class-validator';

export class CreateUploadSessionDto {
  @IsString()
  fileName: string;

  @IsString()
  contentType: string;

  @IsNumber()
  @IsPositive()
  fileSizeBytes: number;
}
