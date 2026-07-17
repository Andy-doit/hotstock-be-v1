import { ApiProperty } from '@nestjs/swagger';
import { IsObject, IsString, MaxLength } from 'class-validator';

export class UpdateSiteSettingsDto {
  @ApiProperty({
    example: {
      marketCryptoUrl:
        'https://www.tradingview-widget.com/embed-widget/market-quotes/',
    },
  })
  @IsObject()
  settings: Record<string, string>;
}

export class SiteSettingResponseDto {
  @ApiProperty()
  @IsString()
  key: string;

  @ApiProperty()
  @IsString()
  @MaxLength(10000)
  value: string;

  @ApiProperty({ required: false })
  label?: string | null;

  @ApiProperty()
  group: string;
}
