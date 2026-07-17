import { Prisma } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
export type ArticleListItem = Prisma.ArticleGetPayload<{
  select: {
    id: true;
    title: true;
    description: true;
    slug: true;
    publishedAt: true;
    coverUrl: true;
    createdAt: true;
    updatedAt: true;
    category: { select: { id: true; name: true; slug: true } };
    tags: { select: { id: true; name: true; slug: true } };
    author: { select: { id: true; username: true } };
  };
}>;
export class ArticlePlanRelation {
  @ApiProperty() planId: number;
  @ApiProperty() plan: { slug: string; level: number };
}
export class ArticleListItemResponse implements Omit<
  ArticleListItem,
  'tags' | 'author' | 'coverUrl' | 'publishedAt'
> {
  @ApiProperty() id: number;
  @ApiProperty() title: string;
  @ApiProperty() description: string;
  @ApiProperty() slug: string;
  @ApiPropertyOptional() publishedAt: Date | null;
  @ApiPropertyOptional() coverUrl: string | null;
  @ApiProperty() category: { id: number; name: string; slug: string };
  @ApiPropertyOptional() tags: Array<{
    id: number;
    name: string;
    slug: string;
  }>;
  @ApiPropertyOptional() author: { id: number; username: string } | null;
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;
}
export class ArticleDetailResponse extends ArticleListItemResponse {
  @ApiProperty({
    description:
      'TipTap JSON content blocks. Shape is dynamic — consumers should validate before use.',
  })
  contentBlocks: Prisma.JsonValue | null;
  @ApiPropertyOptional({ type: [ArticlePlanRelation] })
  plans: ArticlePlanRelation[];
}
export class PaginatedArticlesResponse {
  @ApiProperty({ type: [ArticleListItemResponse] })
  data: ArticleListItemResponse[];

  @ApiPropertyOptional({
    description: 'ID bài viết cuối cùng để lấy trang tiếp',
  })
  nextCursor: number | null;

  @ApiProperty({ description: 'Có trang tiếp theo không' })
  hasNextPage: boolean;
}
