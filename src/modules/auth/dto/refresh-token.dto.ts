import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class RefreshTokenDto {
  @ApiPropertyOptional({
    description:
      'Refresh token fallback for non-browser clients. Browser clients use the HttpOnly refresh_token cookie.',
  })
  @IsString()
  @IsOptional()
  refresh_token?: string;
}
