import {
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import Redis from 'ioredis';
import { clearCache } from '../../common/interceptors/cache.interceptor';
import { safeJsonParse } from '../../common/utils/safe-json-parse';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePortfolioDto } from './dto/create-portfolio.dto';
import {
  PortfolioInformationResponseDto,
  PortfolioReasonResponseDto,
  PortfolioResponseDto,
  PortfolioSignalResponseDto,
  PortfolioStockResponseDto,
} from './dto/portfolio-response.dto';
import { UpdatePortfolioDto } from './dto/update-portfolio.dto';

const portfolioInclude = {
  stocks: true,
  information: true,
  reasons: true,
  signals: true,
  plan: {
    select: {
      id: true,
      name: true,
      slug: true,
      level: true,
    },
  },
} satisfies Prisma.PortfolioInclude;

type PortfolioWithRelations = Prisma.PortfolioGetPayload<{
  include: typeof portfolioInclude;
}>;

const ADMIN_PORTFOLIO_LIST_LIMIT = 100;

@Injectable()
export class PortfoliosService {
  private readonly logger = new Logger(PortfoliosService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
  ) {}

  async findAll(): Promise<PortfolioResponseDto[]> {
    const portfolios = await this.prisma.portfolio.findMany({
      orderBy: { publishedAt: 'desc' },
      include: portfolioInclude,
      take: ADMIN_PORTFOLIO_LIST_LIMIT,
    });

    return portfolios.map((portfolio) => this.mapPortfolio(portfolio));
  }

  async findLatestByPlan(
    planSlug: string,
    userPlanLevel: number,
    bypassPlanCheck = false,
  ): Promise<PortfolioResponseDto> {
    const cacheKey = `portfolio:${planSlug}:level:${bypassPlanCheck ? 'admin' : userPlanLevel}:v2`;

    const cached = await this.redis.get(cacheKey);
    if (cached) {
      const parsed = safeJsonParse<PortfolioResponseDto>(
        cached,
        this.logger,
        cacheKey,
      );
      if (parsed) {
        this.logger.debug(
          `Portfolio findLatestByPlan: cache hit [${cacheKey}]`,
        );
        return parsed;
      }
    }

    const plan = await this.prisma.plan.findUnique({
      where: { slug: planSlug },
      select: { id: true, level: true },
    });

    if (!plan) {
      throw new NotFoundException('Không tìm thấy gói');
    }

    if (!bypassPlanCheck && plan.level > userPlanLevel) {
      throw new ForbiddenException(
        'Bạn cần nâng cấp gói để truy cập nội dung này',
      );
    }

    const portfolio = await this.prisma.portfolio.findFirst({
      where: { planId: plan.id },
      orderBy: { publishedAt: 'desc' },
      include: portfolioInclude,
    });

    if (!portfolio) {
      throw new NotFoundException('Chưa có danh mục đầu tư cho gói này');
    }

    const response = this.mapPortfolio(portfolio);

    await this.redis.set(cacheKey, JSON.stringify(response), 'EX', 3600);
    return response;
  }

  async create(dto: CreatePortfolioDto): Promise<PortfolioResponseDto> {
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
        ...(dto.stocks.length > 0 && {
          stocks: {
            createMany: {
              data: dto.stocks.map((stock) => ({
                symbol: stock.symbol,
                sector: stock.sector ?? null,
                purchaseDate: new Date(stock.purchaseDate),
                costBasis: stock.costBasis,
                marketPrice: stock.marketPrice,
                quantity: stock.quantity,
                note: stock.note ?? null,
              })),
            },
          },
        }),
        ...(dto.information.length > 0 && {
          information: {
            createMany: {
              data: dto.information.map((information) => ({
                month: information.month,
                vnindexReturn: information.vnindexReturn,
                recommendReturn: information.recommendReturn,
              })),
            },
          },
        }),
        ...(dto.reasons.length > 0 && {
          reasons: {
            createMany: {
              data: dto.reasons.map((reason) => ({
                type: reason.type,
                symbol: reason.symbol,
                content: reason.content,
              })),
            },
          },
        }),
        ...(dto.signals.length > 0 && {
          signals: {
            createMany: {
              data: dto.signals.map((signal) => ({
                symbol: signal.symbol,
                signalType: signal.signalType,
                description: signal.description,
                targetPrice: signal.targetPrice ?? null,
                stopLoss: signal.stopLoss ?? null,
              })),
            },
          },
        }),
      },
      include: portfolioInclude,
    });

    await this.invalidateCache();
    return this.mapPortfolio(portfolio);
  }

  async update(
    id: number,
    dto: UpdatePortfolioDto,
  ): Promise<PortfolioResponseDto> {
    const existing = await this.prisma.portfolio.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('Không tìm thấy danh mục đầu tư');
    }

    const portfolio = await this.prisma.$transaction(async (tx) => {
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

      return tx.portfolio.update({
        where: { id },
        data: {
          ...(dto.planId !== undefined && { planId: dto.planId }),
          ...(dto.publishedAt !== undefined && {
            publishedAt: new Date(dto.publishedAt),
          }),
          ...(dto.stocks &&
            dto.stocks.length > 0 && {
              stocks: {
                createMany: {
                  data: dto.stocks.map((stock) => ({
                    symbol: stock.symbol,
                    sector: stock.sector ?? null,
                    purchaseDate: new Date(stock.purchaseDate),
                    costBasis: stock.costBasis,
                    marketPrice: stock.marketPrice,
                    quantity: stock.quantity,
                    note: stock.note ?? null,
                  })),
                },
              },
            }),
          ...(dto.information &&
            dto.information.length > 0 && {
              information: {
                createMany: {
                  data: dto.information.map((information) => ({
                    month: information.month,
                    vnindexReturn: information.vnindexReturn,
                    recommendReturn: information.recommendReturn,
                  })),
                },
              },
            }),
          ...(dto.reasons &&
            dto.reasons.length > 0 && {
              reasons: {
                createMany: {
                  data: dto.reasons.map((reason) => ({
                    type: reason.type,
                    symbol: reason.symbol,
                    content: reason.content,
                  })),
                },
              },
            }),
          ...(dto.signals &&
            dto.signals.length > 0 && {
              signals: {
                createMany: {
                  data: dto.signals.map((signal) => ({
                    symbol: signal.symbol,
                    signalType: signal.signalType,
                    description: signal.description,
                    targetPrice: signal.targetPrice ?? null,
                    stopLoss: signal.stopLoss ?? null,
                  })),
                },
              },
            }),
        },
        include: portfolioInclude,
      });
    });

    await this.invalidateCache();
    return this.mapPortfolio(portfolio);
  }

  async remove(id: number): Promise<void> {
    const existing = await this.prisma.portfolio.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('Không tìm thấy danh mục đầu tư');
    }

    await this.prisma.portfolio.delete({
      where: { id },
    });

    await this.invalidateCache();
  }

  private async invalidateCache(): Promise<void> {
    const patterns = ['portfolio:*', 'cache:*portfolios*'];
    await Promise.all(
      patterns.map((pattern) => clearCache(this.redis, pattern, true)),
    );
  }

  private mapPortfolio(
    portfolio: PortfolioWithRelations,
  ): PortfolioResponseDto {
    return {
      id: portfolio.id,
      planId: portfolio.planId,
      plan: {
        id: portfolio.plan.id,
        name: portfolio.plan.name,
        slug: portfolio.plan.slug,
        level: portfolio.plan.level,
      },
      publishedAt: portfolio.publishedAt,
      createdAt: portfolio.createdAt,
      updatedAt: portfolio.updatedAt,
      ...(portfolio.stocks.length > 0
        ? { stocks: portfolio.stocks.map((stock) => this.mapStock(stock)) }
        : {}),
      ...(portfolio.information.length > 0
        ? {
            information: portfolio.information.map((information) =>
              this.mapInformation(information),
            ),
          }
        : {}),
      ...(portfolio.reasons.length > 0
        ? { reasons: portfolio.reasons.map((reason) => this.mapReason(reason)) }
        : {}),
      ...(portfolio.signals.length > 0
        ? { signals: portfolio.signals.map((signal) => this.mapSignal(signal)) }
        : {}),
    };
  }

  private mapStock(
    stock: PortfolioWithRelations['stocks'][number],
  ): PortfolioStockResponseDto {
    return {
      id: stock.id,
      symbol: stock.symbol,
      sector: stock.sector,
      purchaseDate: stock.purchaseDate,
      costBasis: stock.costBasis,
      marketPrice: stock.marketPrice,
      quantity: stock.quantity,
      note: stock.note,
    };
  }

  private mapInformation(
    information: PortfolioWithRelations['information'][number],
  ): PortfolioInformationResponseDto {
    return {
      id: information.id,
      month: information.month,
      vnindexReturn: information.vnindexReturn,
      recommendReturn: information.recommendReturn,
    };
  }

  private mapReason(
    reason: PortfolioWithRelations['reasons'][number],
  ): PortfolioReasonResponseDto {
    return {
      id: reason.id,
      type: reason.type,
      symbol: reason.symbol,
      content: reason.content,
    };
  }

  private mapSignal(
    signal: PortfolioWithRelations['signals'][number],
  ): PortfolioSignalResponseDto {
    return {
      id: signal.id,
      symbol: signal.symbol,
      signalType: signal.signalType,
      description: signal.description,
      targetPrice: signal.targetPrice,
      stopLoss: signal.stopLoss,
    };
  }
}
