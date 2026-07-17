import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CategoryArticleCountDto {
  @ApiProperty() articles: number;
}

export class CategoryResponseDto {
  @ApiProperty() id: number;
  @ApiProperty() name: string;
  @ApiProperty() slug: string;
  @ApiProperty() isVisibleOnUI: boolean;
  @ApiPropertyOptional({ type: CategoryArticleCountDto })
  _count?: CategoryArticleCountDto;
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;
}
