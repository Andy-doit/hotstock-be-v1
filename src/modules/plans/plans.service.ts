import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Inject,
  Logger,
} from '@nestjs/common';
import { Plan } from '@prisma/client';
import Redis from 'ioredis';
import { PrismaService } from '../../prisma/prisma.service';
import { clearCache } from '../../common/interceptors/cache.interceptor';
import { safeJsonParse } from '../../common/utils/safe-json-parse';
import { CreatePlanDto } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';
import {
  CreatePlanFieldVisibilityDto,
  UpdatePlanFieldVisibilityDto,
} from './dto/plan-field-visibility.dto';

@Injectable()
export class PlansService {
  private readonly logger = new Logger(PlansService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
  ) {}

  /**
   * Return all active plans, ordered by sortOrder asc.
   * Cached in Redis for 24 hours.
   */
  async findAll(): Promise<Plan[]> {
    const cacheKey = 'plans:active:v3';

    // Check service-level cache
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      const parsed = safeJsonParse<Plan[]>(cached, this.logger, cacheKey);
      if (parsed) {
        this.logger.debug('Plans findAll: cache hit');
        return parsed;
      }
    }

    const plans = await this.prisma.plan.findMany({
      where: { isActive: true },
      include: { fieldVisibilities: true },
      orderBy: { sortOrder: 'asc' },
    });

    // Cache for 24 hours
    await this.redis.set(cacheKey, JSON.stringify(plans), 'EX', 86400);
    this.logger.debug(`Plans findAll: cached ${plans.length} plans`);

    return plans;
  }

  /**
   * Return ALL plans (including inactive) for admin dashboard.
   * No caching — admin needs fresh data.
   */
  async findAllAdmin(): Promise<Plan[]> {
    return this.prisma.plan.findMany({
      include: { fieldVisibilities: true },
      orderBy: { sortOrder: 'asc' },
    });
  }

  /**
   * Find a single plan by slug.
   * @throws NotFoundException if not found.
   */
  async findBySlug(slug: string): Promise<Plan> {
    const plan = await this.prisma.plan.findUnique({
      where: { slug },
      include: { fieldVisibilities: true },
    });

    if (!plan) {
      throw new NotFoundException('Không tìm thấy gói');
    }

    return plan;
  }

  /**
   * Create a new plan.
   * @throws ConflictException if slug already taken.
   */
  async create(dto: CreatePlanDto): Promise<Plan> {
    // Check slug uniqueness
    const existing = await this.prisma.plan.findUnique({
      where: { slug: dto.slug },
    });

    if (existing) {
      throw new ConflictException('Slug đã tồn tại');
    }

    const plan = await this.prisma.plan.create({
      data: {
        name: dto.name,
        slug: dto.slug,
        level: dto.level,
        tagline: dto.tagline ?? null,
        icon: dto.icon ?? null,
        theme: dto.theme ?? 'dark',
        badge: dto.badge ?? null,
        monthlyPrice: dto.monthlyPrice,
        semiAnnualPrice: dto.semiAnnualPrice ?? null,
        originalPrice: dto.originalPrice ?? null,
        discountPercent: dto.discountPercent ?? null,
        description: dto.description ?? null,
        features: dto.features,
        ctaLabel: dto.ctaLabel ?? null,
        isPopular: dto.isPopular ?? false,
        highlighted: dto.highlighted ?? false,
        isActive: dto.isActive ?? true,
        sortOrder: dto.sortOrder ?? 0,
        fieldVisibilities: {
          create: {
            dashboardTitle: dto.fieldVisibility?.dashboardTitle ?? null,
            dashboardDescription:
              dto.fieldVisibility?.dashboardDescription ?? null,
            performanceTitle: dto.fieldVisibility?.performanceTitle ?? null,
            performanceDescription:
              dto.fieldVisibility?.performanceDescription ?? null,
            portfolioCompositionTitle:
              dto.fieldVisibility?.portfolioCompositionTitle ?? null,
            portfolioCompositionDescription:
              dto.fieldVisibility?.portfolioCompositionDescription ?? null,
            targetInfoTitle: dto.fieldVisibility?.targetInfoTitle ?? null,
            targetInfoDescription:
              dto.fieldVisibility?.targetInfoDescription ?? null,
            analysisTitle: dto.fieldVisibility?.analysisTitle ?? null,
            analysisDescription:
              dto.fieldVisibility?.analysisDescription ?? null,
            portfolioTableTitle:
              dto.fieldVisibility?.portfolioTableTitle ?? null,
            portfolioTableDescription:
              dto.fieldVisibility?.portfolioTableDescription ?? null,
          },
        },
      },
      include: { fieldVisibilities: true },
    });

    await this.invalidateCache();
    return plan;
  }

  /**
   * Update a plan by slug.
   * slug and level are immutable — any values in dto are ignored.
   * @throws NotFoundException if not found.
   */
  async update(slug: string, dto: UpdatePlanDto): Promise<Plan> {
    const existing = await this.prisma.plan.findUnique({
      where: { slug },
    });

    if (!existing) {
      throw new NotFoundException('Không tìm thấy gói');
    }

    const plan = await this.prisma.plan.update({
      where: { slug },
      data: {
        name: dto.name,
        tagline: dto.tagline,
        icon: dto.icon,
        theme: dto.theme,
        badge: dto.badge,
        monthlyPrice: dto.monthlyPrice,
        semiAnnualPrice: dto.semiAnnualPrice,
        originalPrice: dto.originalPrice,
        discountPercent: dto.discountPercent,
        description: dto.description,
        features: dto.features,
        ctaLabel: dto.ctaLabel,
        isPopular: dto.isPopular,
        highlighted: dto.highlighted,
        isActive: dto.isActive,
        sortOrder: dto.sortOrder,
        fieldVisibilities: dto.fieldVisibility
          ? {
              upsert: {
                create: {
                  dashboardTitle: dto.fieldVisibility.dashboardTitle ?? null,
                  dashboardDescription:
                    dto.fieldVisibility.dashboardDescription ?? null,
                  performanceTitle:
                    dto.fieldVisibility.performanceTitle ?? null,
                  performanceDescription:
                    dto.fieldVisibility.performanceDescription ?? null,
                  portfolioCompositionTitle:
                    dto.fieldVisibility.portfolioCompositionTitle ?? null,
                  portfolioCompositionDescription:
                    dto.fieldVisibility.portfolioCompositionDescription ?? null,
                  targetInfoTitle:
                    dto.fieldVisibility.targetInfoTitle ?? null,
                  targetInfoDescription:
                    dto.fieldVisibility.targetInfoDescription ?? null,
                  analysisTitle: dto.fieldVisibility.analysisTitle ?? null,
                  analysisDescription:
                    dto.fieldVisibility.analysisDescription ?? null,
                  portfolioTableTitle:
                    dto.fieldVisibility.portfolioTableTitle ?? null,
                  portfolioTableDescription:
                    dto.fieldVisibility.portfolioTableDescription ?? null,
                },
                update: {
                  dashboardTitle: dto.fieldVisibility.dashboardTitle,
                  dashboardDescription:
                    dto.fieldVisibility.dashboardDescription,
                  performanceTitle: dto.fieldVisibility.performanceTitle,
                  performanceDescription:
                    dto.fieldVisibility.performanceDescription,
                  portfolioCompositionTitle:
                    dto.fieldVisibility.portfolioCompositionTitle,
                  portfolioCompositionDescription:
                    dto.fieldVisibility.portfolioCompositionDescription,
                  targetInfoTitle: dto.fieldVisibility.targetInfoTitle,
                  targetInfoDescription:
                    dto.fieldVisibility.targetInfoDescription,
                  analysisTitle: dto.fieldVisibility.analysisTitle,
                  analysisDescription:
                    dto.fieldVisibility.analysisDescription,
                  portfolioTableTitle:
                    dto.fieldVisibility.portfolioTableTitle,
                  portfolioTableDescription:
                    dto.fieldVisibility.portfolioTableDescription,
                },
              },
            }
          : undefined,
      },
      include: { fieldVisibilities: true },
    });

    await this.invalidateCache();
    return plan;
  }

  async upsertFieldVisibility(
    slug: string,
    dto: CreatePlanFieldVisibilityDto | UpdatePlanFieldVisibilityDto,
  ) {
    const plan = await this.prisma.plan.findUnique({
      where: { slug },
    });

    if (!plan) {
      throw new NotFoundException('Không tìm thấy gói');
    }

    const visibility = await this.prisma.planFieldVisibility.upsert({
      where: { planId: plan.id },
      create: {
        planId: plan.id,
        dashboardTitle: dto.dashboardTitle ?? null,
        dashboardDescription: dto.dashboardDescription ?? null,
        performanceTitle: dto.performanceTitle ?? null,
        performanceDescription: dto.performanceDescription ?? null,
        portfolioCompositionTitle:
          dto.portfolioCompositionTitle ?? null,
        portfolioCompositionDescription:
          dto.portfolioCompositionDescription ?? null,
        targetInfoTitle: dto.targetInfoTitle ?? null,
        targetInfoDescription: dto.targetInfoDescription ?? null,
        analysisTitle: dto.analysisTitle ?? null,
        analysisDescription: dto.analysisDescription ?? null,
        portfolioTableTitle: dto.portfolioTableTitle ?? null,
        portfolioTableDescription:
          dto.portfolioTableDescription ?? null,
      },
      update: {
        dashboardTitle: dto.dashboardTitle,
        dashboardDescription: dto.dashboardDescription,
        performanceTitle: dto.performanceTitle,
        performanceDescription: dto.performanceDescription,
        portfolioCompositionTitle: dto.portfolioCompositionTitle,
        portfolioCompositionDescription:
          dto.portfolioCompositionDescription,
        targetInfoTitle: dto.targetInfoTitle,
        targetInfoDescription: dto.targetInfoDescription,
        analysisTitle: dto.analysisTitle,
        analysisDescription: dto.analysisDescription,
        portfolioTableTitle: dto.portfolioTableTitle,
        portfolioTableDescription: dto.portfolioTableDescription,
      },
    });

    await this.invalidateCache();
    return visibility;
  }

  /**
   * Remove a plan by slug.
   * @throws NotFoundException if not found.
   * @throws BadRequestException if plan has users assigned.
   */
  async remove(slug: string): Promise<void> {
    const plan = await this.prisma.plan.findUnique({
      where: { slug },
    });

    if (!plan) {
      throw new NotFoundException('Không tìm thấy gói');
    }

    // Check if any users are assigned to this plan
    const userCount = await this.prisma.user.count({
      where: { planId: plan.id },
    });

    if (userCount > 0) {
      throw new BadRequestException(
        'Không thể xóa gói đang có người dùng sử dụng',
      );
    }

    await this.prisma.plan.delete({
      where: { slug },
    });

    await this.invalidateCache();
  }

  /**
   * Invalidate both service-level and interceptor-level cache for plans.
   */
  private async invalidateCache(): Promise<void> {
    await this.redis.del('plans:active');
    await this.redis.del('plans:active:v2');
    await this.redis.del('plans:active:v3');
    await clearCache(this.redis, 'cache:*plans*');
  }
}
