// DTOs for PlanFieldVisibility

import { IsOptional, IsString, IsInt } from 'class-validator';

export class CreatePlanFieldVisibilityDto {
  @IsInt()
  planId: number;

  @IsString()
  @IsOptional()
  dashboardTitle?: string;

  @IsString()
  @IsOptional()
  dashboardDescription?: string;

  @IsString()
  @IsOptional()
  performanceTitle?: string;

  @IsString()
  @IsOptional()
  performanceDescription?: string;

  @IsString()
  @IsOptional()
  portfolioCompositionTitle?: string;

  @IsString()
  @IsOptional()
  portfolioCompositionDescription?: string;

  @IsString()
  @IsOptional()
  targetInfoTitle?: string;

  @IsString()
  @IsOptional()
  targetInfoDescription?: string;

  @IsString()
  @IsOptional()
  analysisTitle?: string;

  @IsString()
  @IsOptional()
  analysisDescription?: string;

  @IsString()
  @IsOptional()
  portfolioTableTitle?: string;

  @IsString()
  @IsOptional()
  portfolioTableDescription?: string;
}

export class UpdatePlanFieldVisibilityDto {
  @IsString()
  @IsOptional()
  dashboardTitle?: string;

  @IsString()
  @IsOptional()
  dashboardDescription?: string;

  @IsString()
  @IsOptional()
  performanceTitle?: string;

  @IsString()
  @IsOptional()
  performanceDescription?: string;

  @IsString()
  @IsOptional()
  portfolioCompositionTitle?: string;

  @IsString()
  @IsOptional()
  portfolioCompositionDescription?: string;

  @IsString()
  @IsOptional()
  targetInfoTitle?: string;

  @IsString()
  @IsOptional()
  targetInfoDescription?: string;

  @IsString()
  @IsOptional()
  analysisTitle?: string;

  @IsString()
  @IsOptional()
  analysisDescription?: string;

  @IsString()
  @IsOptional()
  portfolioTableTitle?: string;

  @IsString()
  @IsOptional()
  portfolioTableDescription?: string;
}

export class PlanFieldVisibilityResponseDto {
  id: number;
  planId: number;
  dashboardTitle?: string;
  dashboardDescription?: string;
  performanceTitle?: string;
  performanceDescription?: string;
  portfolioCompositionTitle?: string;
  portfolioCompositionDescription?: string;
  targetInfoTitle?: string;
  targetInfoDescription?: string;
  analysisTitle?: string;
  analysisDescription?: string;
  portfolioTableTitle?: string;
  portfolioTableDescription?: string;
  createdAt: Date;
  updatedAt: Date;
}
