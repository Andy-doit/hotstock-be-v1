import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Inject,
  Logger,
} from '@nestjs/common';
import { Portfolio, Prisma } from '@prisma/client';
import Redis from 'ioredis';
import { PrismaService } from '../../prisma/prisma.service';
import { clearCache } from '../../common/interceptors/cache.interceptor';
import { CreatePortfolioDto } from './dto/create-portfolio.dto';
import { UpdatePortfolioDto } from './dto/update-portfolio.dto';

import { safeJsonParse } from '../../common/utils/safe-json-parse';

type PortfolioWithRelations = Prisma.PortfolioGetPayload<{
  include: {
    stocks: true;
    information: true;
    reasons: true;
    signals: true;
    plan: true;
  };
}>;

type PortfolioResponse = Omit<
  PortfolioWithRelations,
  'stocks' | 'information' | 'reasons' | 'signals'
> & {
  stocks?: PortfolioWithRelations['stocks'];
  information?: PortfolioWithRelations['information'];
  reasons?: PortfolioWithRelations['reasons'];
  signals?: PortfolioWithRelations['signals'];
};

@Injectable()
export class PortfoliosService {
  private readonly logger = new Logger(PortfoliosService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
  ) {}

  // ─── FIND ALL (ADMIN) ─────────────────────────────────────────────────────

  async findAll(): Promise<PortfolioResponse[]> {
    const portfolios = await this.prisma.portfolio.findMany({
      orderBy: { publishedAt: 'desc' },
      include: {
        stocks: true,
        information: true,
        reasons: true,
        signals: true,
        plan: true,
      },
    });
    return portfolios.map((portfolio) => this.stripEmptyBlocks(portfolio));
  }

  // ─── FIND LATEST BY PLAN ──────────────────────────────────────────────────
  // FIX: Plan check BEFORE cache. Cache key includes planLevel.

  async findLatestByPlan(
    planSlug: string,
    userPlanLevel: number,
    bypassPlanCheck = false,
  ): Promise<PortfolioResponse> {
    const cacheKey = `portfolio:${planSlug}:level:${bypassPlanCheck ? 'admin' : userPlanLevel}`;

    // Check cache FIRST — avoid DB lookup on hit
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      const parsed = safeJsonParse<PortfolioWithRelations>(
        cached,
        this.logger,
        cacheKey,
      );
      if (parsed) {
        this.logger.debug(`Portfolio findLatestByPlan: cache hit [${cacheKey}]`);
        return this.stripEmptyBlocks(parsed);
      }
    }

    // Find plan (only on cache miss)
    const plan = await this.prisma.plan.findUnique({
      where: { slug: planSlug },
      select: { id: true, level: true },
    });

    if (!plan) {
      throw new NotFoundException('Không tìm thấy gói');
    }

    // Plan access check — BEFORE caching to prevent premium content leak
    // Admins/editors bypass the plan restriction
    if (!bypassPlanCheck && plan.level > userPlanLevel) {
      throw new ForbiddenException(
        'Bạn cần nâng cấp gói để truy cập nội dung này',
      );
    }

    const portfolio = await this.prisma.portfolio.findFirst({
      where: { planId: plan.id },
      orderBy: { publishedAt: 'desc' },
      include: {
        stocks: true,
        information: true,
        reasons: true,
        signals: true,
        plan: true,
      },
    });

    if (!portfolio) {
      throw new NotFoundException('Chưa có danh mục đầu tư cho gói này');
    }

    // Cache only after access check passes.
    // IMPORTANT: cache the raw (unstripped) portfolio — stripEmptyBlocks is applied
    // fresh on every read (cache hit or miss). Caching the stripped shape means empty
    // relations are omitted from the JSON entirely, so a later cache-hit re-stripping
    // that object would destructure `undefined` and throw.
    await this.redis.set(cacheKey, JSON.stringify(portfolio), 'EX', 3600);
    return this.stripEmptyBlocks(portfolio);
  }

  // ─── CREATE ────────────────────────────────────────────────────────────────

  async create(dto: CreatePortfolioDto): Promise<PortfolioResponse> {
    // Verify plan exists
    const plan = await this.prisma.plan.findUnique({
      where: { id: dto.planId },
    });

    if (!plan) {
      throw new NotFoundException('Không tìm thấy gói');
    }

    const portfolio = await this.prisma.portfolio.create({
      data: {
        planId: dto.planId,
        publishedAt: new Date(dto.publishedAt),
        ...(dto.stocks.length > 0 && { stocks: {
          createMany: {
            data: dto.stocks.map((s) => ({
              symbol: s.symbol,
              sector: s.sector ?? null,
              purchaseDate: new Date(s.purchaseDate),
              costBasis: s.costBasis,
              marketPrice: s.marketPrice,
              quantity: s.quantity,
              note: s.note ?? null,
            })),
          },
        } }),
        ...(dto.information.length > 0 && { information: {
          createMany: {
            data: dto.information.map((i) => ({
              month: i.month,
              vnindexReturn: i.vnindexReturn,
              recommendReturn: i.recommendReturn,
            })),
          },
        } }),
        ...(dto.reasons.length > 0 && { reasons: {
          createMany: {
            data: dto.reasons.map((r) => ({
              type: r.type,
              symbol: r.symbol,
              content: r.content,
            })),
          },
        } }),
        ...(dto.signals.length > 0 && { signals: {
          createMany: {
            data: dto.signals.map((s) => ({
              symbol: s.symbol,
              signalType: s.signalType,
              description: s.description,
              targetPrice: s.targetPrice ?? null,
              stopLoss: s.stopLoss ?? null,
            })),
          },
        } }),
      },
      include: {
        stocks: true,
        information: true,
        reasons: true,
        signals: true,
        plan: true,
      },
    });

    await this.invalidateCache();
    return this.stripEmptyBlocks(portfolio);
  }

  // ─── UPDATE ────────────────────────────────────────────────────────────────

  async update(
    id: number,
    dto: UpdatePortfolioDto,
  ): Promise<PortfolioResponse> {
    const existing = await this.prisma.portfolio.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('Không tìm thấy danh mục đầu tư');
    }

    // Transaction: delete old nested data, update portfolio, create new nested data
    const portfolio = await this.prisma.$transaction(async (tx) => {
      // Delete existing nested data if new data is provided
      if (dto.stocks) {
        await tx.portfolioStock.deleteMany({ where: { portfolioId: id } });
      }
      if (dto.information) {
        await tx.portfolioInformation.deleteMany({
          where: { portfolioId: id },
        });
      }
      if (dto.reasons) {
        await tx.portfolioReason.deleteMany({ where: { portfolioId: id } });
      }
      if (dto.signals) {
        await tx.portfolioSignal.deleteMany({ where: { portfolioId: id } });
      }

      // Update portfolio and create new nested data
      return tx.portfolio.update({
        where: { id },
        data: {
          ...(dto.planId !== undefined && { planId: dto.planId }),
          ...(dto.publishedAt !== undefined && {
            publishedAt: new Date(dto.publishedAt),
          }),
          ...(dto.stocks && dto.stocks.length > 0 && {
            stocks: {
              createMany: {
                data: dto.stocks.map((s) => ({
                  symbol: s.symbol,
                  sector: s.sector ?? null,
                  purchaseDate: new Date(s.purchaseDate),
                  costBasis: s.costBasis,
                  marketPrice: s.marketPrice,
                  quantity: s.quantity,
                  note: s.note ?? null,
                })),
              },
            },
          }),
          ...(dto.information && dto.information.length > 0 && {
            information: {
              createMany: {
                data: dto.information.map((i) => ({
                  month: i.month,
                  vnindexReturn: i.vnindexReturn,
                  recommendReturn: i.recommendReturn,
                })),
              },
            },
          }),
          ...(dto.reasons && dto.reasons.length > 0 && {
            reasons: {
              createMany: {
                data: dto.reasons.map((r) => ({
                  type: r.type,
                  symbol: r.symbol,
                  content: r.content,
                })),
              },
            },
          }),
          ...(dto.signals && dto.signals.length > 0 && {
            signals: {
              createMany: {
                data: dto.signals.map((s) => ({
                  symbol: s.symbol,
                  signalType: s.signalType,
                  description: s.description,
                  targetPrice: s.targetPrice ?? null,
                  stopLoss: s.stopLoss ?? null,
                })),
              },
            },
          }),
        },
        include: {
          stocks: true,
          information: true,
          reasons: true,
          signals: true,
          plan: true,
        },
      });
    });

    await this.invalidateCache();
    return this.stripEmptyBlocks(portfolio);
  }

  // ─── REMOVE ────────────────────────────────────────────────────────────────

  async remove(id: number): Promise<void> {
    const existing = await this.prisma.portfolio.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('Không tìm thấy danh mục đầu tư');
    }

    // Cascade delete handles sub-relations (onDelete: Cascade in schema)
    await this.prisma.portfolio.delete({
      where: { id },
    });

    await this.invalidateCache();
  }

  // ─── CACHE INVALIDATION ───────────────────────────────────────────────────

  private async invalidateCache(): Promise<void> {
    const patterns = ['portfolio:*', 'cache:*portfolios*'];
    await Promise.all(patterns.map((p) => clearCache(this.redis, p, true)));
  }

  private stripEmptyBlocks(portfolio: PortfolioWithRelations): PortfolioResponse {
    // Defensive against already-stripped input (e.g. a stale cache entry written by
    // an older version of this method) where a relation key may be missing entirely.
    const { stocks = [], information = [], reasons = [], signals = [], ...base } = portfolio;
    return {
      ...base,
      ...(stocks.length > 0 ? { stocks } : {}),
      ...(information.length > 0 ? { information } : {}),
      ...(reasons.length > 0 ? { reasons } : {}),
      ...(signals.length > 0 ? { signals } : {}),
    };
  }
}
