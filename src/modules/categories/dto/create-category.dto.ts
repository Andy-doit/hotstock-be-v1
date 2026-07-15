import { IsString, IsNotEmpty, IsOptional, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCategoryDto {
  @ApiProperty({ example: 'Phân tích kỹ thuật', description: 'Tên danh mục' })
  @IsString()
  @IsNotEmpty({ message: 'Tên danh mục không được để trống' })
  name: string;

  @ApiPropertyOptional({
    example: 'phan-tich-ky-thuat',
    description: 'Slug (tự tạo từ tên nếu bỏ trống)',
  })
  @IsString()
  @IsOptional()
  @Matches(/^[a-z0-9-]+$/, { message: 'Slug không hợp lệ' })
  slug?: string;

  @ApiPropertyOptional({
    example: true,
    description: 'Có hiển thị trên trang chủ không',
  })
  @IsOptional()
  isVisibleOnUI?: boolean;
}
