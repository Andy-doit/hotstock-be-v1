import { IsString, IsInt, IsOptional, IsIn, Min, Max } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ArticleListQueryDto {
  @ApiPropertyOptional({
    example: 'phan-tich-ky-thuat',
    description: 'Lọc theo slug danh mục',
  })
  @IsString()
  @IsOptional()
  category?: string;

  @ApiPropertyOptional({
    example: 'published',
    description:
      'Lọc theo trạng thái: published (đã xuất bản) hoặc draft (bản nháp). Chỉ dùng cho admin.',
    enum: ['published', 'draft'],
  })
  @IsString()
  @IsIn(['published', 'draft'], {
    message: 'status phải là published hoặc draft',
  })
  @IsOptional()
  status?: 'published' | 'draft';

  @ApiPropertyOptional({
    example: 10,
    description: 'ID bài viết cuối cùng (cursor pagination)',
  })
  @IsInt()
  @IsOptional()
  @Transform(({ value }) => (value ? parseInt(value as string, 10) : undefined))
  cursor?: number;

  @ApiPropertyOptional({
    example: 20,
    description: 'Số bài viết mỗi trang (1-50, mặc định 20)',
  })
  @IsInt()
  @Min(1, { message: 'Limit tối thiểu là 1' })
  @Max(50, { message: 'Limit tối đa là 50' })
  @IsOptional()
  @Transform(({ value }) => (value ? parseInt(value as string, 10) : 20))
  limit?: number;
}
