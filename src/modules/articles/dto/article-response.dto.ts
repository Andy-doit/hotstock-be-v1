import { Prisma } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Reusable list-item shape for an article. Mirrors the Prisma select used in
 * ArticlesService.findAll() so the cached payload and the DTO stay in sync.
 */
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

/**
 * Article plan relation shape used in detail responses. Exposes only
 * subscription-relevant fields.
 */
export class ArticlePlanRelation {
  @ApiProperty() planId: number;
  @ApiProperty() plan: { slug: string; level: number };
}

/**
 * Public list-item response. Uses mapped type from Prisma payload so the
 * service never has to cast `as any`.
 */
export class ArticleListItemResponse implements Omit<ArticleListItem, 'tags' | 'author' | 'coverUrl' | 'publishedAt'> {
  @ApiProperty() id: number;
  @ApiProperty() title: string;
  @ApiProperty() description: string;
  @ApiProperty() slug: string;
  @ApiPropertyOptional() publishedAt: Date | null;
  @ApiPropertyOptional() coverUrl: string | null;
  @ApiProperty() category: { id: number; name: string; slug: string };
  @ApiPropertyOptional() tags: Array<{ id: number; name: string; slug: string }>;
  @ApiPropertyOptional() author: { id: number; username: string } | null;
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;
}

/**
 * Single-article response includes `contentBlocks` (TipTap JSON) and
 * associated plan relations for plan-based access checks.
 */
export class ArticleDetailResponse extends ArticleListItemResponse {
  @ApiProperty({ description: 'TipTap JSON content blocks. Shape is dynamic — consumers should validate before use.' })
  contentBlocks: Prisma.JsonValue | null;
  @ApiPropertyOptional({ type: [ArticlePlanRelation] })
  plans: ArticlePlanRelation[];
}

/**
 * Cursor-paginated articles response.
 */
export class PaginatedArticlesResponse {
  @ApiProperty({ type: [ArticleListItemResponse] })
  data: ArticleListItemResponse[];

  @ApiPropertyOptional({ description: 'ID bài viết cuối cùng để lấy trang tiếp' })
  nextCursor: number | null;

  @ApiProperty({ description: 'Có trang tiếp theo không' })
  hasNextPage: boolean;
}
