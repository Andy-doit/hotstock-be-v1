import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TagArticleCountDto {
  @ApiProperty() articles: number;
}

export class TagResponseDto {
  @ApiProperty() id: number;
  @ApiProperty() name: string;
  @ApiProperty() slug: string;
  @ApiPropertyOptional({ type: TagArticleCountDto })
  _count?: TagArticleCountDto;
}
