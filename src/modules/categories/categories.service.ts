import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Inject,
  Logger,
} from '@nestjs/common';
import { Category } from '@prisma/client';
import Redis from 'ioredis';
import { PrismaService } from '../../prisma/prisma.service';
import { clearCache } from '../../common/interceptors/cache.interceptor';
import { safeJsonParse } from '../../common/utils/safe-json-parse';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoriesService {
  private readonly logger = new Logger(CategoriesService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
  ) {}

  /**
   * Return all categories ordered by name asc.
   * Cached in Redis for 1 hour.
   */
  async findAll(): Promise<Category[]> {
    const cacheKey = 'categories:all';

    const cached = await this.redis.get(cacheKey);
    if (cached) {
      const parsed = safeJsonParse<Category[]>(cached, this.logger, cacheKey);
      if (parsed) {
        this.logger.debug('Categories findAll: cache hit');
        return parsed;
      }
    }

    const categories = await this.prisma.category.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: { articles: true }
        }
      }
    });

    await this.redis.set(cacheKey, JSON.stringify(categories), 'EX', 3600);
    this.logger.debug(`Categories findAll: cached ${categories.length} categories`);

    return categories;
  }

  /**
   * Find a single category by slug.
   * @throws NotFoundException if not found.
   */
  async findBySlug(slug: string): Promise<Category> {
    const category = await this.prisma.category.findUnique({
      where: { slug },
    });

    if (!category) {
      throw new NotFoundException('Không tìm thấy danh mục');
    }

    return category;
  }

  /**
   * Create a new category.
   * If slug not provided, auto-generates from name.
   * @throws ConflictException if slug already taken.
   */
  async create(dto: CreateCategoryDto): Promise<Category> {
    const slug = dto.slug || this.generateSlug(dto.name);

    // Check slug uniqueness
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
        ...(dto.isVisibleOnUI !== undefined && { isVisibleOnUI: dto.isVisibleOnUI }),
      },
    });

    await this.invalidateCache();
    return category;
  }

  /**
   * Update a category by slug.
   * @throws NotFoundException if not found.
   * @throws ConflictException if new slug already taken.
   */
  async update(slug: string, dto: UpdateCategoryDto): Promise<Category> {
    const existing = await this.prisma.category.findUnique({
      where: { slug },
    });

    if (!existing) {
      throw new NotFoundException('Không tìm thấy danh mục');
    }

    // If changing slug, check uniqueness of the new slug
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
        ...(dto.isVisibleOnUI !== undefined && { isVisibleOnUI: dto.isVisibleOnUI }),
      },
    });

    await this.invalidateCache();
    return category;
  }

  /**
   * Remove a category by slug.
   * @throws NotFoundException if not found.
   * @throws BadRequestException if category has articles.
   */
  async remove(slug: string): Promise<void> {
    const category = await this.prisma.category.findUnique({
      where: { slug },
    });

    if (!category) {
      throw new NotFoundException('Không tìm thấy danh mục');
    }

    // Check if any articles belong to this category
    const articleCount = await this.prisma.article.count({
      where: { categoryId: category.id },
    });

    if (articleCount > 0) {
      throw new BadRequestException(
        'Không thể xóa danh mục đang có bài viết',
      );
    }

    await this.prisma.category.delete({
      where: { slug },
    });

    await this.invalidateCache();
  }

  /**
   * Auto-generate a URL-safe slug from a name.
   * - Lowercase
   * - Trim whitespace
   * - Replace Vietnamese diacritics with ASCII equivalents
   * - Replace spaces and special chars with hyphens
   * - Remove consecutive hyphens
   * - Remove leading/trailing hyphens
   */
  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .trim()
      // Normalize Vietnamese characters
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      // Replace đ/Đ
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'd')
      // Replace non-alphanumeric chars with hyphens
      .replace(/[^a-z0-9\s-]/g, '')
      // Replace whitespace with hyphens
      .replace(/\s+/g, '-')
      // Remove consecutive hyphens
      .replace(/-+/g, '-')
      // Remove leading/trailing hyphens
      .replace(/^-|-$/g, '');
  }

  /**
   * Invalidate both service-level and interceptor-level cache for categories.
   */
  private async invalidateCache(): Promise<void> {
    await this.redis.del('categories:all');
    await clearCache(this.redis, 'cache:*categories*');
  }
}
