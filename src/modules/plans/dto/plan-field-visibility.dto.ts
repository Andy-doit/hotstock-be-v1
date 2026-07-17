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

export class FieldVisibilityResponseDto {
  dashboardTitle: string | null;
  dashboardDescription: string | null;
  performanceTitle: string | null;
  performanceDescription: string | null;
  portfolioCompositionTitle: string | null;
  portfolioCompositionDescription: string | null;
  targetInfoTitle: string | null;
  targetInfoDescription: string | null;
  analysisTitle: string | null;
  analysisDescription: string | null;
  portfolioTableTitle: string | null;
  portfolioTableDescription: string | null;
}
