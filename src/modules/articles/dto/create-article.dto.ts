import {
  IsString,
  IsNotEmpty,
  IsInt,
  IsArray,
  IsOptional,
  IsDateString,
  IsUrl,
  Matches,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ArticleContentBlockDto {
  @ApiPropertyOptional({ example: 'default-block' })
  @IsString()
  @IsOptional()
  id?: string;

  @ApiPropertyOptional({ example: 'text' })
  @IsString()
  @IsOptional()
  type?: string;

  @ApiProperty({ example: '<p>Nội dung...</p>' })
  @IsString()
  content: string;
}

export class CreateArticleDto {
  @ApiProperty({ example: 'Phân tích VN-Index tuần 24', description: 'Tiêu đề bài viết' })
  @IsString()
  @IsNotEmpty({ message: 'Tiêu đề không được để trống' })
  title: string;

  @ApiProperty({ example: 'Tóm tắt nội dung bài viết', description: 'Mô tả ngắn' })
  @IsString()
  @IsNotEmpty({ message: 'Mô tả không được để trống' })
  description: string;

  @ApiProperty({ example: 'phan-tich-vn-index-tuan-24', description: 'Slug URL' })
  @IsString()
  @Matches(/^[a-z0-9-]+$/, { message: 'Slug không hợp lệ' })
  slug: string;

  @ApiPropertyOptional({ example: '2024-06-15T00:00:00.000Z', description: 'Thời điểm xuất bản' })
  @IsDateString({}, { message: 'Ngày xuất bản không hợp lệ' })
  @IsOptional()
  publishedAt?: string;

  @ApiProperty({
    example: [{ id: 'default-block', type: 'text', content: '<p>Nội dung...</p>' }],
    description: 'Nội dung bài viết dạng block',
    type: [ArticleContentBlockDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ArticleContentBlockDto)
  contentBlocks: ArticleContentBlockDto[];

  @ApiPropertyOptional({ example: '/uploads/cover.jpg' })
  @IsString({ message: 'URL ảnh bìa không hợp lệ' })
  @IsOptional()
  coverUrl?: string;

  @ApiProperty({ example: 1, description: 'ID danh mục' })
  @IsInt({ message: 'categoryId phải là số nguyên' })
  categoryId: number;

  @ApiPropertyOptional({ example: [1, 2], description: 'Mảng ID tags' })
  @IsArray()
  @IsInt({ each: true, message: 'Mỗi tagId phải là số nguyên' })
  @IsOptional()
  tagIds?: number[];

  @ApiPropertyOptional({ example: 'public', description: 'Quyền truy cập (public, member, editor, admin)' })
  @IsString()
  @IsOptional()
  readPermission?: string;

  @ApiPropertyOptional({
    example: [1, 2],
    description: 'Danh sách plan ID có quyền truy cập',
  })
  @IsArray()
  @IsInt({ each: true, message: 'Mỗi planId phải là số nguyên' })
  @IsOptional()
  planIds?: number[];
}
