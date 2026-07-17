import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FieldVisibilityResponseDto } from './plan-field-visibility.dto';

export class SubscriptionPlanResponseDto {
  @ApiProperty() id: number;
  @ApiProperty() name: string;
  @ApiProperty() slug: string;
  @ApiProperty() level: number;
  @ApiPropertyOptional() tagline: string | null;
  @ApiPropertyOptional() icon: string | null;
  @ApiProperty() theme: string;
  @ApiPropertyOptional() badge: string | null;
  @ApiProperty() monthlyPrice: number;
  @ApiPropertyOptional() semiAnnualPrice: number | null;
  @ApiPropertyOptional() originalPrice: number | null;
  @ApiPropertyOptional() discountPercent: number | null;
  @ApiPropertyOptional() description: string | null;
  @ApiProperty({ type: [String] }) features: string[];
  @ApiPropertyOptional() ctaLabel: string | null;
  @ApiProperty() isPopular: boolean;
  @ApiProperty() highlighted: boolean;
  @ApiProperty() isActive: boolean;
  @ApiProperty() sortOrder: number;
  @ApiPropertyOptional({ type: FieldVisibilityResponseDto })
  fieldVisibilities: FieldVisibilityResponseDto | null;
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;
}
