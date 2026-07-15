import { IsString, IsNotEmpty, IsOptional, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateTagDto {
  @ApiProperty({ example: 'Đầu tư giá trị', description: 'Tên thẻ' })
  @IsString()
  @IsNotEmpty({ message: 'Tên thẻ không được để trống' })
  name: string;

  @ApiPropertyOptional({ example: 'dau-tu-gia-tri' })
  @IsString()
  @IsOptional()
  @Matches(/^[a-z0-9-]+$/, { message: 'Slug không hợp lệ' })
  slug?: string;
}
