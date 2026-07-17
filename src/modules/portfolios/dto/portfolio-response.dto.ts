import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PortfolioPlanResponseDto {
  @ApiProperty() id: number;
  @ApiProperty() name: string;
  @ApiProperty() slug: string;
  @ApiProperty() level: number;
}

export class PortfolioStockResponseDto {
  @ApiProperty() id: number;
  @ApiProperty() symbol: string;
  @ApiPropertyOptional() sector: string | null;
  @ApiProperty() purchaseDate: Date;
  @ApiProperty() costBasis: number;
  @ApiProperty() marketPrice: number;
  @ApiProperty() quantity: number;
  @ApiPropertyOptional() note: string | null;
}

export class PortfolioInformationResponseDto {
  @ApiProperty() id: number;
  @ApiProperty() month: string;
  @ApiProperty() vnindexReturn: number;
  @ApiProperty() recommendReturn: number;
}

export class PortfolioReasonResponseDto {
  @ApiProperty() id: number;
  @ApiProperty() type: string;
  @ApiProperty() symbol: string;
  @ApiProperty() content: string;
}

export class PortfolioSignalResponseDto {
  @ApiProperty() id: number;
  @ApiProperty() symbol: string;
  @ApiProperty() signalType: string;
  @ApiProperty() description: string;
  @ApiPropertyOptional() targetPrice: number | null;
  @ApiPropertyOptional() stopLoss: number | null;
}

export class PortfolioResponseDto {
  @ApiProperty() id: number;
  @ApiProperty() planId: number;
  @ApiPropertyOptional({ type: PortfolioPlanResponseDto })
  plan?: PortfolioPlanResponseDto;
  @ApiProperty() publishedAt: Date;
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;
  @ApiPropertyOptional({ type: [PortfolioStockResponseDto] })
  stocks?: PortfolioStockResponseDto[];
  @ApiPropertyOptional({ type: [PortfolioInformationResponseDto] })
  information?: PortfolioInformationResponseDto[];
  @ApiPropertyOptional({ type: [PortfolioReasonResponseDto] })
  reasons?: PortfolioReasonResponseDto[];
  @ApiPropertyOptional({ type: [PortfolioSignalResponseDto] })
  signals?: PortfolioSignalResponseDto[];
}
