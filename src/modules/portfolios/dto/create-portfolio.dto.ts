import {
  IsString,
  IsNotEmpty,
  IsInt,
  IsNumber,
  IsArray,
  IsOptional,
  IsDateString,
  IsIn,
  ValidateNested,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// ─── Nested DTOs ────────────────────────────────────────────────────────────

export class PortfolioStockDto {
  @ApiProperty({ example: 'VNM' })
  @IsString()
  @IsNotEmpty({ message: 'Mã cổ phiếu không được để trống' })
  symbol: string;

  @ApiPropertyOptional({ example: 'Năng lượng' })
  @IsString()
  @IsOptional()
  sector?: string;

  @ApiProperty({ example: '2024-06-01T00:00:00.000Z' })
  @IsDateString({}, { message: 'Ngày mua không hợp lệ' })
  purchaseDate: string;

  @ApiProperty({ example: 85000 })
  @IsNumber()
  @Min(0, { message: 'Giá mua không được âm' })
  costBasis: number;

  @ApiProperty({ example: 92000 })
  @IsNumber()
  @Min(0, { message: 'Giá thị trường không được âm' })
  marketPrice: number;

  @ApiProperty({ example: 100 })
  @IsInt()
  @Min(0, { message: 'Số lượng không được âm' })
  quantity: number;

  @ApiPropertyOptional({ example: 'Mua thêm ở vùng hỗ trợ' })
  @IsString()
  @IsOptional()
  note?: string;
}

export class PortfolioInformationDto {
  @ApiProperty({ example: '2024-06' })
  @IsString()
  @IsNotEmpty({ message: 'Tháng không được để trống' })
  month: string;

  @ApiProperty({ example: 5.2 })
  @IsNumber()
  vnindexReturn: number;

  @ApiProperty({ example: 8.7 })
  @IsNumber()
  recommendReturn: number;
}

export class PortfolioReasonDto {
  @ApiProperty({ example: 'buy', enum: ['buy', 'sell'] })
  @IsString()
  @IsIn(['buy', 'sell'], { message: 'type phải là buy hoặc sell' })
  type: string;

  @ApiProperty({ example: 'VNM' })
  @IsString()
  @IsNotEmpty({ message: 'Mã cổ phiếu không được để trống' })
  symbol: string;

  @ApiProperty({ example: 'Kết quả kinh doanh Q2 tốt hơn kỳ vọng' })
  @IsString()
  @IsNotEmpty({ message: 'Nội dung không được để trống' })
  content: string;
}

export class PortfolioSignalDto {
  @ApiProperty({ example: 'VNM' })
  @IsString()
  @IsNotEmpty({ message: 'Mã cổ phiếu không được để trống' })
  symbol: string;

  @ApiProperty({ example: 'breakout' })
  @IsString()
  @IsNotEmpty({ message: 'Loại tín hiệu không được để trống' })
  signalType: string;

  @ApiProperty({ example: 'Breakout khỏi vùng kháng cự 90,000' })
  @IsString()
  @IsNotEmpty({ message: 'Mô tả không được để trống' })
  description: string;

  @ApiPropertyOptional({ example: 95000 })
  @IsNumber()
  @IsOptional()
  targetPrice?: number;

  @ApiPropertyOptional({ example: 87000 })
  @IsNumber()
  @IsOptional()
  stopLoss?: number;
}

// ─── Main DTO ───────────────────────────────────────────────────────────────

export class CreatePortfolioDto {
  @ApiProperty({ example: 1, description: 'ID gói' })
  @IsInt({ message: 'planId phải là số nguyên' })
  planId: number;

  @ApiProperty({ example: '2024-06-15T00:00:00.000Z', description: 'Ngày công bố' })
  @IsDateString({}, { message: 'Ngày công bố không hợp lệ' })
  publishedAt: string;

  @ApiProperty({ type: [PortfolioStockDto], description: 'Danh sách cổ phiếu' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PortfolioStockDto)
  stocks: PortfolioStockDto[];

  @ApiProperty({ type: [PortfolioInformationDto], description: 'Thông tin hiệu suất' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PortfolioInformationDto)
  information: PortfolioInformationDto[];

  @ApiProperty({ type: [PortfolioReasonDto], description: 'Lý do mua/bán' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PortfolioReasonDto)
  reasons: PortfolioReasonDto[];

  @ApiProperty({ type: [PortfolioSignalDto], description: 'Tín hiệu giao dịch' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PortfolioSignalDto)
  signals: PortfolioSignalDto[];
}
