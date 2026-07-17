import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SiteSettingResponseDto } from './dto/update-site-settings.dto';

export const DEFAULT_SITE_SETTINGS: Array<{
  key: string;
  value: string;
  label: string;
  group: string;
}> = [
  {
    key: 'marketCryptoUrl',
    label: 'Bảng giá crypto',
    group: 'iframes',
    value:
      'https://www.tradingview-widget.com/embed-widget/market-quotes/?locale=en#%7B%22colorTheme%22%3A%22light%22%2C%22largeChartUrl%22%3A%22%22%2C%22isTransparent%22%3Afalse%2C%22showSymbolLogo%22%3Atrue%2C%22backgroundColor%22%3A%22%23ffffff%22%2C%22width%22%3A820%2C%22height%22%3A600%2C%22symbolsGroups%22%3A%5B%7B%22name%22%3A%22Crypto%22%2C%22symbols%22%3A%5B%7B%22name%22%3A%22BINANCE%3ABTCUSDT%22%2C%22displayName%22%3A%22BTC%22%7D%2C%7B%22name%22%3A%22BINANCE%3AETHUSDT%22%2C%22displayName%22%3A%22ETH%22%7D%2C%7B%22name%22%3A%22BINANCE%3ABNBUSDT%22%2C%22displayName%22%3A%22BNB%22%7D%2C%7B%22name%22%3A%22BINANCE%3ASOLUSDT%22%2C%22displayName%22%3A%22SOL%22%7D%2C%7B%22name%22%3A%22BINANCE%3AXRPUSDT%22%2C%22displayName%22%3A%22XRP%22%7D%2C%7B%22name%22%3A%22BINANCE%3ADOGEUSDT%22%2C%22displayName%22%3A%22DOGE%22%7D%2C%7B%22name%22%3A%22BINANCE%3ASHIBUSDT%22%2C%22displayName%22%3A%22SHIB%22%7D%2C%7B%22name%22%3A%22BINANCE%3ATONUSDT%22%2C%22displayName%22%3A%22TON%22%7D%2C%7B%22name%22%3A%22BINANCE%3ALTCUSDT%22%2C%22displayName%22%3A%22LTC%22%7D%2C%7B%22name%22%3A%22BINANCE%3AAVAXUSDT%22%2C%22displayName%22%3A%22AVAX%22%7D%2C%7B%22name%22%3A%22BINANCE%3ADOTUSDT%22%2C%22displayName%22%3A%22DOT%22%7D%2C%7B%22name%22%3A%22BINANCE%3ASUIUSDT%22%2C%22displayName%22%3A%22SUI%22%7D%2C%7B%22name%22%3A%22OKX%3ALEOUSDT%22%2C%22displayName%22%3A%22LEO%22%7D%5D%7D%5D%2C%22utm_source%22%3A%22hotstockvn.com%22%2C%22utm_medium%22%3A%22widget_new%22%2C%22utm_campaign%22%3A%22market-quotes%22%2C%22page-uri%22%3A%22hotstockvn.com%2Fcrypto%2F%22%7D',
  },
  {
    key: 'marketFxUrl',
    label: 'Tỷ giá ngoại tệ',
    group: 'iframes',
    value:
      'https://www.widgets.investing.com/live-currency-cross-rates?theme=darkTheme&pairs=1,3,2,4,7,5,8,6,2214,1206220,1062759,2229',
  },
  {
    key: 'marketGoldUrl',
    label: 'Giá vàng',
    group: 'iframes',
    value: 'https://tygiausd.org/giavangfull/dat-gia-vang/widgets',
  },
  {
    key: 'marketCalendarUrl',
    label: 'Lịch kinh tế',
    group: 'iframes',
    value:
      'https://sslecal2.investing.com?defaultFont=%230d0000&columns=exc_flags,exc_currency,exc_importance,exc_actual,exc_forecast,exc_previous&features=datepicker,timezone&countries=33,14,4,34,38,32,6,11,51,5,39,72,60,110,43,35,71,22,36,26,12,9,37,25,178,10,17&calType=week&timeZone=27&lang=52',
  },
  {
    key: 'marketStockVnUrl',
    label: 'Bảng giá chứng khoán Việt Nam',
    group: 'iframes',
    value: 'https://trading.bsi.com.vn/',
  },
];

const SITE_SETTINGS_LIST_LIMIT = DEFAULT_SITE_SETTINGS.length;

const ALLOWED_IFRAME_ORIGINS = new Set([
  'https://www.tradingview-widget.com',
  'https://www.tradingview.com',
  'https://tygiausd.org',
  'https://www.widgets.investing.com',
  'https://sslecal2.investing.com',
  'https://trading.bsi.com.vn',
  'https://www.google.com',
]);

const normalizeIframeUrl = (key: string, value: string): string => {
  if (typeof value !== 'string') {
    throw new BadRequestException(`Invalid iframe URL for ${key}`);
  }

  const trimmed = value.trim();
  if (!trimmed) return '';

  try {
    const url = new URL(trimmed);
    if (url.protocol === 'https:' && ALLOWED_IFRAME_ORIGINS.has(url.origin)) {
      return url.toString();
    }
  } catch {
    throw new BadRequestException(`Invalid iframe URL for ${key}`);
  }

  throw new BadRequestException(`Invalid iframe URL for ${key}`);
};

@Injectable()
export class SiteSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async ensureDefaults(): Promise<void> {
    for (const setting of DEFAULT_SITE_SETTINGS) {
      await this.prisma.siteSetting.upsert({
        where: { key: setting.key },
        update: { label: setting.label, group: setting.group },
        create: setting,
      });
    }
  }

  async findPublic(group?: string): Promise<SiteSettingResponseDto[]> {
    await this.ensureDefaults();
    const settings = await this.prisma.siteSetting.findMany({
      where: group ? { group } : undefined,
      orderBy: { key: 'asc' },
      take: SITE_SETTINGS_LIST_LIMIT,
    });

    return settings.map((setting) => this.mapSetting(setting));
  }

  async findAdmin(group?: string): Promise<SiteSettingResponseDto[]> {
    await this.ensureDefaults();
    const settings = await this.prisma.siteSetting.findMany({
      where: group ? { group } : undefined,
      orderBy: { key: 'asc' },
      take: SITE_SETTINGS_LIST_LIMIT,
    });

    return settings.map((setting) => this.mapSetting(setting));
  }

  async updateMany(
    settings: Record<string, string>,
  ): Promise<SiteSettingResponseDto[]> {
    const allowed = new Map(
      DEFAULT_SITE_SETTINGS.map((setting) => [setting.key, setting]),
    );
    const updates = Object.entries(settings).filter(([key]) =>
      allowed.has(key),
    );

    await this.prisma.$transaction(
      updates.map(([key, value]) => {
        const setting = allowed.get(key)!;
        const normalizedValue = normalizeIframeUrl(key, value);
        return this.prisma.siteSetting.upsert({
          where: { key },
          update: { value: normalizedValue },
          create: { ...setting, value: normalizedValue },
        });
      }),
    );

    return this.findAdmin('iframes');
  }

  private mapSetting(setting: SiteSettingResponseDto): SiteSettingResponseDto {
    return {
      key: setting.key,
      value: setting.value,
      label: setting.label,
      group: setting.group,
    };
  }
}
