import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Inject,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import Redis from 'ioredis';
import { PrismaService } from '../../prisma/prisma.service';
import { clearCache } from '../../common/interceptors/cache.interceptor';
import { safeJsonParse } from '../../common/utils/safe-json-parse';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { CategoryResponseDto } from './dto/category-response.dto';

type CategoryRecord = Prisma.CategoryGetPayload<Prisma.CategoryDefaultArgs>;
type CategoryWithCount = Prisma.CategoryGetPayload<{
  include: { _count: { select: { articles: true } } };
}>;
type CategoryMapperInput = CategoryRecord | CategoryWithCount;

const CATEGORY_LIST_LIMIT = 500;

@Injectable()
export class CategoriesService {
  private readonly logger = new Logger(CategoriesService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
  ) {}
  async findAll(): Promise<CategoryResponseDto[]> {
    const cacheKey = 'categories:all:v3';

    const cached = await this.redis.get(cacheKey);
    if (cached) {
      const parsed = safeJsonParse<CategoryResponseDto[]>(
        cached,
        this.logger,
        cacheKey,
      );
      if (parsed) {
        this.logger.debug('Categories findAll: cache hit');
        return parsed;
      }
    }

    const categories = await this.prisma.category.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: { articles: true },
        },
      },
      take: CATEGORY_LIST_LIMIT,
    });

    const response = categories.map((category) => this.mapCategory(category));

    await this.redis.set(cacheKey, JSON.stringify(response), 'EX', 3600);
    this.logger.debug(
      `Categories findAll: cached ${categories.length} categories`,
    );

    return response;
  }
  async findBySlug(slug: string): Promise<CategoryResponseDto> {
    const category = await this.prisma.category.findUnique({
      where: { slug },
    });

    if (!category) {
      throw new NotFoundException('Không tìm thấy danh mục');
    }

    return this.mapCategory(category);
  }
  async create(dto: CreateCategoryDto): Promise<CategoryResponseDto> {
    const slug = dto.slug || this.generateSlug(dto.name);
    const existing = await this.prisma.category.findUnique({
      where: { slug },
    });

    if (existing) {
      throw new ConflictException('Slug đã tồn tại');
    }

    const category = await this.prisma.category.create({
      data: {
        name: dto.name,
        slug,
        ...(dto.isVisibleOnUI !== undefined && {
          isVisibleOnUI: dto.isVisibleOnUI,
        }),
      },
    });

    await this.invalidateCache();
    return this.mapCategory(category);
  }
  async update(
    slug: string,
    dto: UpdateCategoryDto,
  ): Promise<CategoryResponseDto> {
    const existing = await this.prisma.category.findUnique({
      where: { slug },
    });

    if (!existing) {
      throw new NotFoundException('Không tìm thấy danh mục');
    }
    if (dto.slug && dto.slug !== slug) {
      const slugTaken = await this.prisma.category.findUnique({
        where: { slug: dto.slug },
      });

      if (slugTaken) {
        throw new ConflictException('Slug đã tồn tại');
      }
    }

    const category = await this.prisma.category.update({
      where: { slug },
      data: {
        name: dto.name,
        slug: dto.slug,
        ...(dto.isVisibleOnUI !== undefined && {
          isVisibleOnUI: dto.isVisibleOnUI,
        }),
      },
    });

    await this.invalidateCache();
    return this.mapCategory(category);
  }
  async remove(slug: string): Promise<void> {
    const category = await this.prisma.category.findUnique({
      where: { slug },
    });

    if (!category) {
      throw new NotFoundException('Không tìm thấy danh mục');
    }
    const articleCount = await this.prisma.article.count({
      where: { categoryId: category.id },
    });

    if (articleCount > 0) {
      throw new BadRequestException('Không thể xóa danh mục đang có bài viết');
    }

    await this.prisma.category.delete({
      where: { slug },
    });

    await this.invalidateCache();
  }
  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'd')
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }
  private async invalidateCache(): Promise<void> {
    await this.redis.del('categories:all');
    await this.redis.del('categories:all:v2');
    await this.redis.del('categories:all:v3');
    await clearCache(this.redis, 'cache:*categories*');
  }

  private mapCategory(category: CategoryMapperInput): CategoryResponseDto {
    return {
      id: category.id,
      name: category.name,
      slug: category.slug,
      isVisibleOnUI: category.isVisibleOnUI,
      ...('_count' in category
        ? { _count: { articles: category._count.articles } }
        : {}),
      createdAt: category.createdAt,
      updatedAt: category.updatedAt,
    };
  }
}
