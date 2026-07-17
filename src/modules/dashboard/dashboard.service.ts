import { Injectable, Inject, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import Redis from 'ioredis';
import { safeJsonParse } from '../../common/utils/safe-json-parse';

export interface DashboardStats {
  overview: {
    totalArticles: number;
    publishedArticles: number;
    draftArticles: number;
    totalUsers: number;
    totalCategories: number;
    totalPortfolios: number;
  };
  usersByRole: Array<{ role: string; count: number }>;
  articlesByCategory: Array<{ name: string; count: number }>;
  recentArticles: Array<{
    id: number;
    title: string;
    slug: string;
    publishedAt: Date | null;
    coverUrl: string | null;
    createdAt: Date;
    category: { id: number; name: string; slug: string } | null;
    author: { id: number; username: string } | null;
  }>;
  recentUsers: Array<{
    id: number;
    username: string;
    email: string;
    role: string;
    createdAt: Date;
  }>;
}

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);
  private static readonly CACHE_KEY = 'dashboard:stats';
  private static readonly CACHE_TTL = 60;
  private static readonly CATEGORY_NAME_LOOKUP_LIMIT = 500;

  constructor(
    private readonly prisma: PrismaService,
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
  ) {}

  async getStats(): Promise<DashboardStats> {
    const cached = await this.redis.get(DashboardService.CACHE_KEY);
    if (cached) {
      const parsed = safeJsonParse<DashboardStats>(
        cached,
        this.logger,
        DashboardService.CACHE_KEY,
      );
      if (parsed) {
        this.logger.debug('Dashboard getStats: cache hit');
        return parsed;
      }
    }
    const [
      totalArticles,
      totalUsers,
      totalCategories,
      totalPortfolios,
      publishedArticles,
      draftArticles,
      usersByRole,
      articlesByCategory,
      categories,
      recentArticles,
      recentUsers,
    ] = await Promise.all([
      this.prisma.article.count(),
      this.prisma.user.count(),
      this.prisma.category.count(),
      this.prisma.portfolio.count(),
      this.prisma.article.count({ where: { publishedAt: { not: null } } }),
      this.prisma.article.count({ where: { publishedAt: null } }),
      this.prisma.user.groupBy({ by: ['role'], _count: { id: true } }),
      this.prisma.article.groupBy({ by: ['categoryId'], _count: { id: true } }),
      this.prisma.category.findMany({
        select: { id: true, name: true },
        take: DashboardService.CATEGORY_NAME_LOOKUP_LIMIT,
      }),
      this.prisma.article.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          title: true,
          slug: true,
          publishedAt: true,
          coverUrl: true,
          createdAt: true,
          category: { select: { id: true, name: true, slug: true } },
          author: { select: { id: true, username: true } },
        },
      }),
      this.prisma.user.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          username: true,
          email: true,
          role: true,
          createdAt: true,
        },
      }),
    ]);
    const categoryMap = new Map(categories.map((c) => [c.id, c.name]));

    const articlesByCategoryChart = articlesByCategory.map((item) => ({
      name: categoryMap.get(item.categoryId) ?? 'Unknown',
      count: item._count.id,
    }));

    const result: DashboardStats = {
      overview: {
        totalArticles,
        publishedArticles,
        draftArticles,
        totalUsers,
        totalCategories,
        totalPortfolios,
      },
      usersByRole: usersByRole.map((r) => ({
        role: String(r.role),
        count: r._count.id,
      })),
      articlesByCategory: articlesByCategoryChart,
      recentArticles,
      recentUsers,
    };
    await this.redis.set(
      DashboardService.CACHE_KEY,
      JSON.stringify(result),
      'EX',
      DashboardService.CACHE_TTL,
    );

    return result;
  }
}
