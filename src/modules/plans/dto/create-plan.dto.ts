import {
  IsString,
  IsNotEmpty,
  IsInt,
  IsNumber,
  IsBoolean,
  IsArray,
  IsOptional,
  Matches,
  Min,
  Max,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { CreatePlanFieldVisibilityDto } from './plan-field-visibility.dto';

export class CreatePlanDto {
  @ApiProperty({ example: 'Gold', description: 'Tên gói' })
  @IsString()
  @IsNotEmpty({ message: 'Tên gói không được để trống' })
  name: string;

  @ApiProperty({ example: 'gold', description: 'Slug (URL-safe)' })
  @IsString()
  @Matches(/^[a-z0-9-]+$/, {
    message: 'Slug chỉ được chứa chữ thường, số và dấu gạch ngang',
  })
  slug: string;

  @ApiProperty({ example: 3, description: 'Cấp độ gói (0 = free)' })
  @IsInt()
  @Min(0)
  level: number;

  @ApiPropertyOptional({ example: 'Gói nâng cao' })
  @IsString()
  @IsOptional()
  tagline?: string;

  @ApiPropertyOptional({
    example: 'shield',
    description: 'Tên icon để frontend map sang icon UI',
  })
  @IsString()
  @IsOptional()
  icon?: string;

  @ApiPropertyOptional({
    example: 'gold',
    description: 'Theme màu của plan: dark | purple | gold',
  })
  @IsString()
  @Matches(/^(dark|purple|gold)$/, {
    message: 'Theme phải là dark, purple hoặc gold',
  })
  @IsOptional()
  theme?: string;

  @ApiPropertyOptional({ example: 'Phổ biến nhất' })
  @IsString()
  @IsOptional()
  badge?: string;

  @ApiProperty({ example: 8000000, description: 'Giá hàng tháng (VND)' })
  @IsNumber()
  @Min(0, { message: 'Giá không được âm' })
  monthlyPrice: number;

  @ApiPropertyOptional({ example: 31680000 })
  @IsNumber()
  @Min(0, { message: 'Giá không được âm' })
  @IsOptional()
  semiAnnualPrice?: number;

  @ApiPropertyOptional({ example: 48000000 })
  @IsNumber()
  @Min(0, { message: 'Giá không được âm' })
  @IsOptional()
  originalPrice?: number;

  @ApiPropertyOptional({ example: 34, description: '% giảm giá (0-100)' })
  @IsInt()
  @Min(0)
  @Max(100)
  @IsOptional()
  discountPercent?: number;

  @ApiPropertyOptional({ example: 'Mô tả chi tiết gói' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    example: ['Feature 1', 'Feature 2'],
    description: 'Danh sách tính năng',
  })
  @IsArray()
  @IsString({ each: true })
  features: string[];

  @ApiPropertyOptional({ example: 'Chọn Gold' })
  @IsString()
  @IsOptional()
  ctaLabel?: string;

  @ApiPropertyOptional({ example: false })
  @IsBoolean()
  @IsOptional()
  isPopular?: boolean;

  @ApiPropertyOptional({
    example: true,
    description: 'Plan được highlight/featured trên UI',
  })
  @IsBoolean()
  @IsOptional()
  highlighted?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional({ example: 3 })
  @IsInt()
  @IsOptional()
  sortOrder?: number;

  @ApiPropertyOptional({
    description:
      'Cấu hình các phần dữ liệu/section được phép hiển thị theo plan',
    type: CreatePlanFieldVisibilityDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => CreatePlanFieldVisibilityDto)
  fieldVisibility?: CreatePlanFieldVisibilityDto;
}
