import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  Inject,
  Logger,
} from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import Redis from 'ioredis';
import { PrismaService } from '../../prisma/prisma.service';
import { clearCache } from '../../common/interceptors/cache.interceptor';
import {
  ArticleContentBlockDto,
  CreateArticleDto,
} from './dto/create-article.dto';
import { UpdateArticleDto } from './dto/update-article.dto';
import { ArticleListQueryDto } from './dto/article-list-query.dto';
import {
  ArticleListItem,
  ArticleDetailResponse,
  PaginatedArticlesResponse,
} from './dto/article-response.dto';
import { safeJsonParse } from '../../common/utils/safe-json-parse';

const articleDetailSelect = Prisma.validator<Prisma.ArticleSelect>()({
  id: true,
  title: true,
  description: true,
  slug: true,
  publishedAt: true,
  coverUrl: true,
  contentBlocks: true,
  createdAt: true,
  updatedAt: true,
  category: { select: { id: true, name: true, slug: true } },
  tags: { select: { id: true, name: true, slug: true } },
  author: { select: { id: true, username: true } },
  plans: {
    select: {
      planId: true,
      plan: { select: { slug: true, level: true } },
    },
  },
});

type ArticleDetailRecord = Prisma.ArticleGetPayload<{
  select: typeof articleDetailSelect;
}>;

const ARTICLE_LIST_CACHE_SCHEMA_VERSION = 'v2';

@Injectable()
export class ArticlesService {
  private readonly logger = new Logger(ArticlesService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
  ) {}

  async findAll(
    query: ArticleListQueryDto,
  ): Promise<PaginatedArticlesResponse> {
    const limit = Math.min(query.limit ?? 20, 100);
    const cursor = query.cursor;
    const categorySlug = query.category;

    const cacheKey = `articles:list:${ARTICLE_LIST_CACHE_SCHEMA_VERSION}:${categorySlug ?? 'all'}:${cursor ?? 0}:${limit}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      const parsed = safeJsonParse<PaginatedArticlesResponse>(
        cached,
        this.logger,
        cacheKey,
      );
      if (parsed) {
        this.logger.debug(`Articles findAll: cache hit [${cacheKey}]`);
        return parsed;
      }
    }

    // Resolve categoryId from slug if provided. Unknown categories return an
    // empty page instead of accidentally removing the category filter.
    let categoryId: number | undefined;
    if (categorySlug) {
      const category = await this.prisma.category.findUnique({
        where: { slug: categorySlug },
        select: { id: true },
      });
      if (!category) {
        const result: PaginatedArticlesResponse = {
          data: [],
          nextCursor: null,
          hasNextPage: false,
        };
        await this.redis.set(cacheKey, JSON.stringify(result), 'EX', 300);
        return result;
      }
      categoryId = category.id;
    }

    const where: Prisma.ArticleWhereInput = {
      publishedAt: { not: null },
      ...(categoryId !== undefined && { categoryId }),
    };

    const articles: ArticleListItem[] = await this.prisma.article.findMany({
      where,
      take: limit + 1,
      ...(cursor && {
        cursor: { id: cursor },
        skip: 1,
      }),
      orderBy: { publishedAt: 'desc' },
      select: {
        id: true,
        title: true,
        slug: true,
        description: true,
        coverUrl: true,
        publishedAt: true,
        createdAt: true,
        updatedAt: true,
        category: { select: { id: true, name: true, slug: true } },
        tags: { select: { id: true, name: true, slug: true } },
        author: { select: { id: true, username: true } },
      },
    });

    const hasNextPage = articles.length > limit;
    const data = hasNextPage ? articles.slice(0, limit) : articles;
    const nextCursor = data.length > 0 ? data[data.length - 1].id : null;

    const result: PaginatedArticlesResponse = {
      data,
      nextCursor: hasNextPage ? nextCursor : null,
      hasNextPage,
    };

    await this.redis.set(cacheKey, JSON.stringify(result), 'EX', 300);

    return result;
  }

  async findAllOwn(
    userId: number,
    query: ArticleListQueryDto,
  ): Promise<PaginatedArticlesResponse> {
    const limit = query.limit ?? 20;
    const cursor = query.cursor;
    const categorySlug = query.category;

    let categoryId: number | undefined;
    if (categorySlug) {
      const category = await this.prisma.category.findUnique({
        where: { slug: categorySlug },
        select: { id: true },
      });
      if (!category) {
        return {
          data: [],
          nextCursor: null,
          hasNextPage: false,
        };
      }
      categoryId = category.id;
    }

    const where: Prisma.ArticleWhereInput = {
      authorId: userId,
      ...(categoryId !== undefined && { categoryId }),
    };

    const articles = await this.prisma.article.findMany({
      where,
      take: limit + 1,
      ...(cursor && {
        cursor: { id: cursor },
        skip: 1,
      }),
      orderBy: { createdAt: 'desc' },
      include: {
        category: true,
        tags: true,
        author: {
          select: { id: true, username: true },
        },
      },
    });

    const hasNextPage = articles.length > limit;
    const data = hasNextPage ? articles.slice(0, limit) : articles;
    const nextCursor = data.length > 0 ? data[data.length - 1].id : null;

    return {
      data,
      nextCursor: hasNextPage ? nextCursor : null,
      hasNextPage,
    };
  }

  async findAllAdmin(
    query: ArticleListQueryDto,
  ): Promise<PaginatedArticlesResponse> {
    const limit = query.limit ?? 20;
    const cursor = query.cursor;
    const categorySlug = query.category;

    // Resolve categoryId from slug if provided. Unknown categories should not
    // broaden the query to every article.
    let categoryId: number | undefined;
    if (categorySlug) {
      const category = await this.prisma.category.findUnique({
        where: { slug: categorySlug },
        select: { id: true },
      });
      if (!category) {
        return {
          data: [],
          nextCursor: null,
          hasNextPage: false,
        };
      }
      categoryId = category.id;
    }

    const statusFilter: Prisma.ArticleWhereInput =
      query.status === 'published'
        ? { publishedAt: { not: null } }
        : query.status === 'draft'
          ? { publishedAt: null }
          : {};

    const where: Prisma.ArticleWhereInput = {
      ...statusFilter,
      ...(categoryId !== undefined && { categoryId }),
    };

    const articles = await this.prisma.article.findMany({
      where,
      take: limit + 1,
      ...(cursor && {
        cursor: { id: cursor },
        skip: 1,
      }),
      orderBy: { createdAt: 'desc' },
      include: {
        category: true,
        tags: true,
        author: {
          select: { id: true, username: true },
        },
      },
    });

    const hasNextPage = articles.length > limit;
    const data = hasNextPage ? articles.slice(0, limit) : articles;
    const nextCursor = data.length > 0 ? data[data.length - 1].id : null;

    return {
      data,
      nextCursor: hasNextPage ? nextCursor : null,
      hasNextPage,
    };
  }

  async findBySlugAdmin(slug: string): Promise<ArticleDetailResponse> {
    const article = await this.prisma.article.findUnique({
      where: { slug },
      select: articleDetailSelect,
    });

    if (!article) {
      throw new NotFoundException('Không tìm thấy bài viết');
    }

    return this.mapArticleDetail(article);
  }

  async findBySlug(
    slug: string,
    userPlanLevel: number,
    bypassPlanCheck = false,
  ): Promise<ArticleDetailResponse> {
    // Cache key includes userPlanLevel so each tier gets its own cached version
    const cacheKey = `articles:v2:slug:${slug}:level:${bypassPlanCheck ? 'admin' : userPlanLevel}`;
    const cached = await this.redis.get(cacheKey);

    if (cached) {
      const parsed = safeJsonParse<ArticleDetailResponse>(
        cached,
        this.logger,
        cacheKey,
      );
      if (parsed) {
        this.logger.debug(`Articles findBySlug: cache hit [${cacheKey}]`);
        const sanitized = this.sanitizeArticleDetailResponse(parsed);
        if (this.hasUnsafeAuthorPayload(parsed)) {
          await this.redis.set(cacheKey, JSON.stringify(sanitized), 'EX', 600);
        }
        return sanitized;
      }
    }

    const article = await this.prisma.article.findFirst({
      where: { slug, publishedAt: { not: null } },
      select: articleDetailSelect,
    });

    if (!article) {
      throw new NotFoundException('Không tìm thấy bài viết');
    }

    // Plan-based access control — check BEFORE caching to prevent premium content leak
    // Admins/editors bypass the plan restriction
    if (!bypassPlanCheck && article.plans.length > 0) {
      const hasAccess = article.plans.some(
        (ap) => ap.plan.level <= userPlanLevel,
      );
      if (!hasAccess) {
        throw new ForbiddenException(
          'Bạn cần nâng cấp gói để truy cập nội dung này',
        );
      }
    }

    const response = this.mapArticleDetail(article);
    await this.redis.set(cacheKey, JSON.stringify(response), 'EX', 600);
    return response;
  }

  async create(
    dto: CreateArticleDto,
    userId: number,
    userRole?: string,
  ): Promise<ArticleDetailResponse> {
    void userRole;

    const existing = await this.prisma.article.findUnique({
      where: { slug: dto.slug },
    });

    if (existing) {
      throw new ConflictException('Slug đã tồn tại');
    }

    const article = await this.prisma.article.create({
      data: {
        title: dto.title,
        description: dto.description,
        slug: dto.slug,
        publishedAt: dto.publishedAt ? new Date(dto.publishedAt) : null,
        contentBlocks: this.mapContentBlocks(dto.contentBlocks),
        coverUrl: dto.coverUrl ?? null,
        readPermission: dto.readPermission ?? 'public',
        categoryId: dto.categoryId,
        authorId: userId,
        tags: dto.tagIds?.length
          ? { connect: dto.tagIds.map((id) => ({ id })) }
          : undefined,
        plans: {
          create: dto.planIds?.map((planId) => ({ planId })) ?? [],
        },
      },
      select: articleDetailSelect,
    });

    await this.invalidateCache();
    return this.mapArticleDetail(article);
  }

  async update(
    slug: string,
    dto: UpdateArticleDto,
    userRole?: string,
  ): Promise<ArticleDetailResponse> {
    void userRole;
    const existing = await this.prisma.article.findUnique({
      where: { slug },
    });

    if (!existing) {
      throw new NotFoundException('Không tìm thấy bài viết');
    }

    if (dto.slug && dto.slug !== slug) {
      const slugTaken = await this.prisma.article.findUnique({
        where: { slug: dto.slug },
      });
      if (slugTaken) {
        throw new ConflictException('Slug đã tồn tại');
      }
    }

    const article = await this.prisma.$transaction(async (tx) => {
      if (dto.planIds !== undefined) {
        await tx.articlePlan.deleteMany({
          where: { articleId: existing.id },
        });
      }

      return tx.article.update({
        where: { slug },
        data: {
          ...(dto.title !== undefined && { title: dto.title }),
          ...(dto.description !== undefined && {
            description: dto.description,
          }),
          ...(dto.slug !== undefined && { slug: dto.slug }),
          ...(dto.publishedAt !== undefined && {
            publishedAt: dto.publishedAt ? new Date(dto.publishedAt) : null,
          }),
          ...(dto.contentBlocks !== undefined && {
            contentBlocks: this.mapContentBlocks(dto.contentBlocks),
          }),
          ...(dto.coverUrl !== undefined && { coverUrl: dto.coverUrl }),
          ...(dto.readPermission !== undefined && {
            readPermission: dto.readPermission,
          }),
          ...(dto.categoryId !== undefined && { categoryId: dto.categoryId }),
          ...(dto.tagIds !== undefined && {
            tags: {
              set: dto.tagIds.map((id) => ({ id })),
            },
          }),
          ...(dto.planIds !== undefined && {
            plans: {
              create: dto.planIds.map((planId) => ({ planId })),
            },
          }),
        },
        select: articleDetailSelect,
      });
    });

    await this.invalidateCache();
    return this.mapArticleDetail(article);
  }

  async remove(slug: string, userId: number, userRole: string): Promise<void> {
    const article = await this.prisma.article.findUnique({
      where: { slug },
    });

    if (!article) {
      throw new NotFoundException('Không tìm thấy bài viết');
    }

    const canDeleteArticle =
      userRole === Role.admin ||
      (userRole === Role.editor && article.authorId === userId);

    if (!canDeleteArticle) {
      throw new ForbiddenException('Bạn không có quyền xóa bài viết này');
    }

    await this.prisma.$transaction([
      this.prisma.articlePlan.deleteMany({
        where: { articleId: article.id },
      }),
      this.prisma.article.delete({
        where: { slug },
      }),
    ]);

    await this.invalidateCache();
  }

  private async invalidateCache(): Promise<void> {
    const patterns = ['articles:*', 'cache:*articles*'];
    await Promise.all(patterns.map((p) => clearCache(this.redis, p, true)));
  }

  private mapContentBlocks(
    blocks: ArticleContentBlockDto[],
  ): Prisma.InputJsonArray {
    return blocks.map((block) => ({
      ...(block.id !== undefined && { id: block.id }),
      ...(block.type !== undefined && { type: block.type }),
      content: block.content,
    }));
  }

  private mapArticleDetail(
    article: ArticleDetailRecord,
  ): ArticleDetailResponse {
    return {
      id: article.id,
      title: article.title,
      description: article.description,
      slug: article.slug,
      publishedAt: article.publishedAt,
      coverUrl: article.coverUrl,
      category: article.category,
      tags: article.tags,
      author: article.author
        ? {
            id: article.author.id,
            username: article.author.username,
          }
        : null,
      createdAt: article.createdAt,
      updatedAt: article.updatedAt,
      contentBlocks: article.contentBlocks,
      plans: article.plans.map(({ planId, plan }) => ({
        planId,
        plan: {
          slug: plan.slug,
          level: plan.level,
        },
      })),
    };
  }

  private sanitizeArticleDetailResponse(
    article: ArticleDetailResponse,
  ): ArticleDetailResponse {
    return {
      ...article,
      author: article.author
        ? {
            id: article.author.id,
            username: article.author.username,
          }
        : null,
      plans: Array.isArray(article.plans)
        ? article.plans.map(({ planId, plan }) => ({
            planId,
            plan: {
              slug: plan.slug,
              level: plan.level,
            },
          }))
        : [],
    };
  }

  private hasUnsafeAuthorPayload(article: ArticleDetailResponse): boolean {
    const author = article.author;
    return (
      author !== null &&
      typeof author === 'object' &&
      ('passwordHash' in author ||
        'email' in author ||
        'role' in author ||
        'provider' in author)
    );
  }
}
