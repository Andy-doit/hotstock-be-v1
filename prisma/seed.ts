import { PrismaClient, Role } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();
const prismaDynamic = prisma as PrismaClient & {
  planFieldVisibility: {
    upsert: (args: {
      where: { planId: number };
      update: Record<string, unknown>;
      create: Record<string, unknown>;
    }) => Promise<unknown>;
  };
};
const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const LONG_SECRET_PATTERN = /\b[A-Za-z0-9_-]{24,}\b/g;

function maskEmail(value: string): string {
  const [localPart, domain = ''] = value.split('@');
  const visibleLocal = localPart.slice(0, 2);
  const visibleDomain = domain.slice(0, 2);
  return `${visibleLocal || '**'}***@${visibleDomain || '**'}***`;
}

function maskSensitiveSeedLogValue(value: string): string {
  return value
    .replace(EMAIL_PATTERN, (email) => maskEmail(email))
    .replace(LONG_SECRET_PATTERN, '[redacted-secret]');
}

function getSafeSeedErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return maskSensitiveSeedLogValue(error.message);
  }

  if (
    typeof error === 'string' ||
    typeof error === 'number' ||
    typeof error === 'boolean' ||
    typeof error === 'bigint'
  ) {
    return maskSensitiveSeedLogValue(error.toString());
  }

  return 'Unknown seed error';
}

interface PlanSeed {
  name: string;
  slug: string;
  level: number;
  tagline: string | null;
  badge: string | null;
  monthlyPrice: number;
  semiAnnualPrice: number | null;
  originalPrice: number | null;
  discountPercent: number | null;
  description: string | null;
  features: string[];
  ctaLabel: string | null;
  isPopular: boolean;
  isActive: boolean;
  sortOrder: number;
}

interface SeedPortfolioStock {
  symbol: string;
  sector: string;
  purchaseDate: string;
  costBasis: number;
  marketPrice: number;
  weight: number;
  stopLoss: number;
  targetPrice: number;
  beta: number;
  mdd: number;
  thesis: string;
  signal: string;
}

interface SeedPortfolioMetric {
  label: string;
  value: number;
}

interface SeedPortfolioData {
  publishedAt: string;
  vnindexReturn: number;
  recommendReturn: number;
  managerName: string;
  website: string;
  stocks: SeedPortfolioStock[];
  metrics: SeedPortfolioMetric[];
}

const plans: PlanSeed[] = [
  {
    name: 'Free',
    slug: 'free',
    level: 0,
    tagline: 'Gói miễn phí',
    badge: null,
    monthlyPrice: 0,
    semiAnnualPrice: null,
    originalPrice: null,
    discountPercent: null,
    description: 'Trải nghiệm cơ bản hoàn toàn miễn phí.',
    features: [],
    ctaLabel: 'Bắt đầu miễn phí',
    isPopular: false,
    isActive: true,
    sortOrder: 0,
  },
  {
    name: 'Titan',
    slug: 'titan',
    level: 1,
    tagline: 'Gói khởi đầu',
    badge: null,
    monthlyPrice: 1500000,
    semiAnnualPrice: null,
    originalPrice: null,
    discountPercent: null,
    description:
      'Truy cập tin tức, biểu đồ cơ bản cùng báo cáo hiệu quả hàng tháng để xây nền tảng đầu tư vững chắc.',
    features: [
      '3–5 mã/tháng, có điểm mua bán, stop-loss',
      'Báo cáo hiệu quả hàng tháng',
      'Email/Zalo hỗ trợ, trả lời trong 24h',
    ],
    ctaLabel: 'Chọn Titan',
    isPopular: false,
    isActive: true,
    sortOrder: 1,
  },
  {
    name: 'Premium',
    slug: 'premium',
    level: 3,
    tagline: 'Gói chuyên sâu',
    badge: 'Phổ biến nhất',
    monthlyPrice: 15000000,
    semiAnnualPrice: null,
    originalPrice: null,
    discountPercent: null,
    description:
      'Toàn bộ đặc quyền cao cấp: livestream phiên giao dịch, coaching 1-1 và phân tích cá nhân hoá.',
    features: [
      'Khuyến nghị danh mục, phân tích chi tiết từng cổ phiếu',
      'Báo cáo tuần & tháng, phân tích cá nhân hoá',
      'Coaching 1–1, tư vấn riêng qua Zoom',
    ],
    ctaLabel: 'Nâng cấp ngay',
    isPopular: true,
    isActive: true,
    sortOrder: 3,
  },
  {
    name: 'Gold',
    slug: 'gold',
    level: 2,
    tagline: 'Gói nâng cao',
    badge: null,
    monthlyPrice: 8000000,
    semiAnnualPrice: 31680000,
    originalPrice: 48000000,
    discountPercent: 34,
    description:
      'Nhận cập nhật chiến lược linh hoạt, báo cáo chuyên sâu và hỗ trợ trực tiếp từ đội ngũ.',
    features: [
      '5–8 mã/tháng, cập nhật linh hoạt',
      'Báo cáo tuần + tháng. Dashboard lợi nhuận tháng',
      'Webinar hàng tháng, hotline giờ hành chính',
    ],
    ctaLabel: 'Chọn Gold',
    isPopular: false,
    isActive: true,
    sortOrder: 2,
  },
];

const portfolioSeedByPlan: Record<string, SeedPortfolioData> = {
  free: {
    publishedAt: '2025-11-16T09:00:00.000Z',
    vnindexReturn: 0.0337,
    recommendReturn: 0.0412,
    managerName: 'Hotstock Community',
    website: 'Hotstockvn.com',
    stocks: [
      {
        symbol: 'FPT',
        sector: 'Công nghệ',
        purchaseDate: '2025-11-11',
        costBasis: 138.4,
        marketPrice: 144.2,
        weight: 0.34,
        stopLoss: 132,
        targetPrice: 156,
        beta: 0.84,
        mdd: 0.095,
        thesis:
          'Mã vốn hóa lớn, xu hướng trung hạn tích cực, phù hợp làm danh mục cộng đồng dễ theo dõi.',
        signal:
          'Ưu tiên nắm giữ khi giá còn trên 132.00; mục tiêu gần là vùng 156.00.',
      },
      {
        symbol: 'HPG',
        sector: 'Thép',
        purchaseDate: '2025-11-11',
        costBasis: 27.8,
        marketPrice: 29.1,
        weight: 0.33,
        stopLoss: 26.4,
        targetPrice: 32.5,
        beta: 1.12,
        mdd: 0.118,
        thesis:
          'Hưởng lợi từ kỳ vọng chu kỳ ngành thép hồi phục, thanh khoản tốt và dễ tiếp cận với người dùng free.',
        signal:
          'Có thể tiếp tục theo dõi nắm giữ; dừng lỗ nếu mất vùng 26.40.',
      },
      {
        symbol: 'VCB',
        sector: 'Ngân hàng',
        purchaseDate: '2025-11-11',
        costBasis: 91.5,
        marketPrice: 93.8,
        weight: 0.33,
        stopLoss: 88,
        targetPrice: 101,
        beta: 0.76,
        mdd: 0.072,
        thesis:
          'Cổ phiếu ngân hàng đầu ngành, biến động vừa phải, phù hợp làm ví dụ minh hoạ danh mục cộng đồng.',
        signal:
          'Giữ vị thế nếu xu hướng vẫn ổn định trên vùng hỗ trợ 88.00.',
      },
    ],
    metrics: [
      { label: 'Tỷ số Sharpe', value: 0.512 },
      { label: 'Beta', value: 0.91 },
      { label: 'Giá trị alpha danh mục', value: 0.0075 },
      { label: 'Rủi ro của danh mục', value: 0.0261 },
      { label: 'Tỷ lệ chiết khấu từ đỉnh', value: 0.132 },
      { label: 'Lợi nhuận VNINDEX', value: 0.0337 },
      { label: 'Lợi nhuận danh mục', value: 0.0412 },
    ],
  },
  titan: {
    publishedAt: '2025-11-16T09:00:00.000Z',
    vnindexReturn: 0.0337,
    recommendReturn: 0.0521,
    managerName: 'Hotstock Thảo Lena',
    website: 'Hotstockvn.com',
    stocks: [
      {
        symbol: 'PVT',
        sector: 'Năng lượng',
        purchaseDate: '2025-11-10',
        costBasis: 17.5,
        marketPrice: 18.7,
        weight: 0.34,
        stopLoss: 16.65,
        targetPrice: 26.7,
        beta: 0.49,
        mdd: 0.4241,
        thesis:
          'MA200/MA100 hỗ trợ xu hướng trung hạn, dòng tiền quay lại quanh vùng hỗ trợ chính.',
        signal:
          'Ưu tiên nắm giữ khi giá vẫn trên hỗ trợ 16.65; theo dõi phản ứng tại vùng 19.2–19.5.',
      },
      {
        symbol: 'DCM',
        sector: 'Phân bón',
        purchaseDate: '2025-11-10',
        costBasis: 33.7,
        marketPrice: 35,
        weight: 0.33,
        stopLoss: 32,
        targetPrice: 41.8,
        beta: 0.89,
        mdd: 0.268,
        thesis:
          'Khối lượng cải thiện sau nền tích lũy, lợi thế khi nhóm phân bón hút dòng tiền ngắn hạn.',
        signal:
          'Có thể gia tăng khi vượt vùng cản gần; dừng lỗ nếu thủng 32 với thanh khoản cao.',
      },
      {
        symbol: 'MBS',
        sector: 'Tài chính',
        purchaseDate: '2025-11-10',
        costBasis: 28.6,
        marketPrice: 30.5,
        weight: 0.33,
        stopLoss: 27.2,
        targetPrice: 37,
        beta: 1.97,
        mdd: 0.3321,
        thesis:
          'Chứng khoán hưởng lợi khi thanh khoản thị trường duy trì, MBS đang giữ xu hướng tăng ngắn hạn.',
        signal:
          'Nắm giữ theo đà; lưu ý biến động cao do beta lớn hơn 1.9.',
      },
    ],
    metrics: [
      { label: 'Tỷ số Sharpe', value: 0.7423 },
      { label: 'Beta', value: 1.11 },
      { label: 'Giá trị alpha danh mục', value: 0.0214 },
      { label: 'Rủi ro của danh mục', value: 0.0382 },
      { label: 'Tỷ lệ chiết khấu từ đỉnh', value: 0.2145 },
      { label: 'Lợi nhuận VNINDEX', value: 0.0337 },
      { label: 'Lợi nhuận danh mục', value: 0.0521 },
    ],
  },
  premium: {
    publishedAt: '2025-11-16T09:00:00.000Z',
    vnindexReturn: 0.0337,
    recommendReturn: 0.07900122627125591,
    managerName: 'Hotstock Thảo Lena',
    website: 'Hotstockvn.com',
    stocks: [
      {
        symbol: 'PVT',
        sector: 'Năng lượng',
        purchaseDate: '2025-11-10',
        costBasis: 17.5,
        marketPrice: 18.7,
        weight: 0.25,
        stopLoss: 16.65,
        targetPrice: 26.7,
        beta: 0.49,
        mdd: 0.4241,
        thesis:
          'MA/Trend: MA200/MA100 hỗ trợ; xu hướng ngắn hạn giữ trên đường hỗ trợ chính, phù hợp tiếp tục nắm giữ.',
        signal:
          'Động lượng MACD cải thiện, volume ổn định. Dừng lỗ 16.65, mục tiêu 26.70.',
      },
      {
        symbol: 'DCM',
        sector: 'Phân bón',
        purchaseDate: '2025-11-10',
        costBasis: 33.7,
        marketPrice: 35,
        weight: 0.25,
        stopLoss: 32,
        targetPrice: 41.8,
        beta: 0.89,
        mdd: 0.268,
        thesis:
          'Vùng hỗ trợ mạnh quanh POC, tín hiệu hồi phục rõ khi MACD cắt lên và dòng tiền quay lại.',
        signal:
          'Canh gia tăng gần hỗ trợ, stop-loss 32.00, kỳ vọng hướng tới 41.80.',
      },
      {
        symbol: 'MBS',
        sector: 'Tài chính',
        purchaseDate: '2025-11-10',
        costBasis: 28.6,
        marketPrice: 30.5,
        weight: 0.25,
        stopLoss: 27.2,
        targetPrice: 37,
        beta: 1.97,
        mdd: 0.3321,
        thesis:
          'Cổ phiếu chứng khoán có beta cao, phù hợp giai đoạn thị trường ưu tiên nhóm dẫn sóng.',
        signal:
          'Giữ theo xu hướng, theo dõi kỹ biến động khi thị trường rung lắc mạnh.',
      },
      {
        symbol: 'HAG',
        sector: 'Nông nghiệp',
        purchaseDate: '2025-11-13',
        costBasis: 16.5,
        marketPrice: 18.85,
        weight: 0.25,
        stopLoss: 15.7,
        targetPrice: 20,
        beta: 0.93,
        mdd: 0.122,
        thesis:
          'Cấu trúc giá đang phục hồi sau nhịp điều chỉnh, vùng cầu hấp thụ tốt quanh nền gần nhất.',
        signal:
          'Tiếp tục nắm giữ nếu giá duy trì trên 17.0; mục tiêu ngắn hạn 20.00.',
      },
    ],
    metrics: [
      { label: 'Tỷ số Sharpe', value: 0.8777123386263456 },
      { label: 'Beta', value: 1.0699999999999998 },
      { label: 'Giá trị alpha danh mục', value: 0.054712226271255916 },
      { label: 'Rủi ro của danh mục', value: 0.04443508944205384 },
      { label: 'Tỷ lệ chiết khấu từ đỉnh', value: 0.28654999999999997 },
      { label: 'Lợi nhuận VNINDEX', value: 0.0337 },
      { label: 'Lợi nhuận danh mục', value: 0.07900122627125591 },
    ],
  },
  gold: {
    publishedAt: '2025-11-16T09:00:00.000Z',
    vnindexReturn: 0.0337,
    recommendReturn: 0.0942,
    managerName: 'Hotstock Thảo Lena',
    website: 'Hotstockvn.com',
    stocks: [
      {
        symbol: 'PVT',
        sector: 'Năng lượng',
        purchaseDate: '2025-11-10',
        costBasis: 17.5,
        marketPrice: 18.7,
        weight: 0.2,
        stopLoss: 16.65,
        targetPrice: 26.7,
        beta: 0.49,
        mdd: 0.4241,
        thesis:
          'PVT giữ xu hướng tăng bền với nền giá tích lũy tốt, phù hợp vai trò trụ ổn định trong danh mục.',
        signal:
          'Ưu tiên nắm giữ; tín hiệu xác nhận khi vượt vùng đỉnh ngắn hạn với thanh khoản.',
      },
      {
        symbol: 'DCM',
        sector: 'Phân bón',
        purchaseDate: '2025-11-10',
        costBasis: 33.7,
        marketPrice: 35,
        weight: 0.2,
        stopLoss: 32,
        targetPrice: 41.8,
        beta: 0.89,
        mdd: 0.268,
        thesis:
          'DCM đang vận động tích cực nhờ câu chuyện ngành và mặt bằng kỹ thuật ủng hộ.',
        signal:
          'Canh gia tăng ở nhịp điều chỉnh kỹ thuật; mục tiêu trung hạn 41.80.',
      },
      {
        symbol: 'MBS',
        sector: 'Tài chính',
        purchaseDate: '2025-11-10',
        costBasis: 28.6,
        marketPrice: 30.5,
        weight: 0.2,
        stopLoss: 27.2,
        targetPrice: 37,
        beta: 1.97,
        mdd: 0.3321,
        thesis:
          'MBS đại diện cho nhóm beta cao giúp khuếch đại hiệu suất danh mục khi xu hướng thuận lợi.',
        signal:
          'Giữ tỷ trọng vừa phải để kiểm soát biến động nhưng vẫn tận dụng nhịp tăng.',
      },
      {
        symbol: 'HAG',
        sector: 'Nông nghiệp',
        purchaseDate: '2025-11-13',
        costBasis: 16.5,
        marketPrice: 18.85,
        weight: 0.2,
        stopLoss: 15.7,
        targetPrice: 20,
        beta: 0.93,
        mdd: 0.122,
        thesis:
          'HAG duy trì cấu trúc phục hồi ổn, là mã bổ sung giúp đa dạng hóa ngoài tài chính và phân bón.',
        signal:
          'Theo dõi phản ứng quanh vùng 19–20 để chốt lãi từng phần.',
      },
      {
        symbol: 'FPT',
        sector: 'Công nghệ',
        purchaseDate: '2025-11-12',
        costBasis: 138.4,
        marketPrice: 144.2,
        weight: 0.2,
        stopLoss: 132,
        targetPrice: 156,
        beta: 0.84,
        mdd: 0.095,
        thesis:
          'FPT bổ sung lớp tăng trưởng chất lượng, phù hợp gói cao hơn với góc nhìn cân bằng tăng trưởng và phòng thủ.',
        signal:
          'Giữ vị thế trung hạn; có thể gia tăng nếu test lại vùng hỗ trợ 140 thành công.',
      },
    ],
    metrics: [
      { label: 'Tỷ số Sharpe', value: 0.9634 },
      { label: 'Beta', value: 1.02 },
      { label: 'Giá trị alpha danh mục', value: 0.0618 },
      { label: 'Rủi ro của danh mục', value: 0.0412 },
      { label: 'Tỷ lệ chiết khấu từ đỉnh', value: 0.1941 },
      { label: 'Lợi nhuận VNINDEX', value: 0.0337 },
      { label: 'Lợi nhuận danh mục', value: 0.0942 },
    ],
  },
};

async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 1,
  });
}

async function seedPlanVisibilities(): Promise<void> {
  const visibilityBySlug = {
    free: {
      dashboardTitle: 'Danh mục cộng đồng',
      dashboardDescription: 'Gói Free được xem bảng danh mục cộng đồng với các mã tham khảo cơ bản.',
      portfolioTableTitle: 'Bảng danh mục cộng đồng',
      portfolioTableDescription: 'Danh sách các mã cộng đồng có thể theo dõi miễn phí ở mức thông tin cơ bản.',
    },
    titan: {
      dashboardTitle: 'Danh mục Titan',
      dashboardDescription: 'Xem hiệu suất và bảng danh mục cơ bản của gói Titan.',
      performanceTitle: 'Hiệu suất danh mục Titan',
      performanceDescription: 'So sánh nhanh với VNINDEX.',
      portfolioTableTitle: 'Bảng danh mục Titan',
      portfolioTableDescription: 'Danh sách mã, giá vốn, giá thị trường và tỷ trọng cơ bản.',
    },
    premium: {
      dashboardTitle: 'Danh mục Premium',
      dashboardDescription: 'Toàn bộ dashboard và phân tích chi tiết cho gói Premium.',
      performanceTitle: 'Hiệu suất danh mục vs VNINDEX',
      performanceDescription: 'So sánh hiệu suất khuyến nghị với thị trường.',
      portfolioCompositionTitle: 'Tỷ trọng danh mục',
      portfolioCompositionDescription: 'Phân bổ tỷ trọng theo từng mã khuyến nghị.',
      targetInfoTitle: 'Mục tiêu và chỉ số danh mục',
      targetInfoDescription: 'Theo dõi stop-loss, mục tiêu và chỉ số tổng hợp.',
      analysisTitle: 'Lý do hỗ trợ',
      analysisDescription: 'Các luận điểm chính cho từng mã trong danh mục.',
      portfolioTableTitle: 'Bảng danh mục tham chiếu',
      portfolioTableDescription: 'Tóm tắt mã, ngành, giá vốn, tỷ trọng, lãi/lỗ, dừng lỗ, mục tiêu, beta, MDD.',
    },
    gold: {
      dashboardTitle: 'Danh mục Gold',
      dashboardDescription: 'Gói Gold hiển thị đầy đủ dashboard với danh mục mở rộng hơn để test phân quyền.',
      performanceTitle: 'Hiệu suất danh mục Gold vs VNINDEX',
      performanceDescription: 'Mô phỏng dashboard cao cấp với hiệu suất và mức sinh lời cao hơn.',
      portfolioCompositionTitle: 'Tỷ trọng danh mục Gold',
      portfolioCompositionDescription: 'Danh mục nhiều mã hơn để kiểm tra bố cục biểu đồ.',
      targetInfoTitle: 'Thông tin cơ bản danh mục Gold',
      targetInfoDescription: 'Hiển thị chỉ số tổng hợp và vùng mục tiêu/rủi ro.',
      analysisTitle: 'Luận điểm đầu tư Gold',
      analysisDescription: 'Các thẻ phân tích sâu dùng để test quyền truy cập đầy đủ.',
      portfolioTableTitle: 'Bảng danh mục Gold',
      portfolioTableDescription: 'Bảng chi tiết đầy đủ cho nhóm người dùng cấp cao hơn.',
    },
  } as const;

  for (const [slug, visibility] of Object.entries(visibilityBySlug)) {
    const plan = await prisma.plan.findUnique({ where: { slug } });

    if (!plan) {
      continue;
    }

    await prismaDynamic.planFieldVisibility.upsert({
      where: { planId: plan.id },
      update: visibility,
      create: {
        planId: plan.id,
        ...visibility,
      },
    });

    console.log(`  ✅ Field visibility seeded for plan "${slug}"`);
  }
}

async function seedUsers(seedAdminPassword: string): Promise<void> {
  const defaultPassword = process.env.SEED_TEST_USER_PASSWORD || seedAdminPassword;
  const passwordHash = await hashPassword(defaultPassword);

  const planEntries = await prisma.plan.findMany({
    where: { slug: { in: ['free', 'titan', 'premium', 'gold'] } },
  });

  const planIdBySlug = Object.fromEntries(
    planEntries.map((plan) => [plan.slug, plan.id]),
  );

  const users = [
    {
      email: 'titan.user@app.com',
      username: 'titan_user',
      fullName: 'Titan Test User',
      role: Role.user,
      planSlug: 'titan',
    },
    {
      email: 'premium.user@app.com',
      username: 'premium_user',
      fullName: 'Premium Test User',
      role: Role.user,
      planSlug: 'premium',
    },
    {
      email: 'gold.user@app.com',
      username: 'gold_user',
      fullName: 'Gold Test User',
      role: Role.user,
      planSlug: 'gold',
    },
  ];

  for (const user of users) {
    const planId = planIdBySlug[user.planSlug];

    if (!planId) {
      const userLabel = maskEmail(user.email);
      console.warn(
        `  ⚠️ Skip user "${userLabel}" because plan "${user.planSlug}" was not found`,
      );
      continue;
    }

    const upserted = await prisma.user.upsert({
      where: { email: user.email },
      update: {
        username: user.username,
        fullName: user.fullName,
        role: user.role,
        planId,
        passwordHash,
        blocked: false,
        confirmed: true,
      },
      create: {
        email: user.email,
        username: user.username,
        fullName: user.fullName,
        role: user.role,
        planId,
        passwordHash,
        blocked: false,
        confirmed: true,
      },
    });

    const seededUserLabel = maskEmail(upserted.email);
    console.log(
      `  ✅ Test user "${seededUserLabel}" attached to plan "${user.planSlug}"`,
    );
  }

  console.log('  ℹ️ Test users seeded with configured password');
}

async function seedPortfolios(): Promise<void> {
  for (const [planSlug, data] of Object.entries(portfolioSeedByPlan)) {
    const plan = await prisma.plan.findUnique({ where: { slug: planSlug } });

    if (!plan) {
      console.warn(`  ⚠️ Skip portfolio seed because plan "${planSlug}" was not found`);
      continue;
    }

    await prisma.portfolio.deleteMany({
      where: {
        planId: plan.id,
        publishedAt: new Date(data.publishedAt),
      },
    });

    const portfolio = await prisma.portfolio.create({
      data: {
        planId: plan.id,
        publishedAt: new Date(data.publishedAt),
        stocks: {
          createMany: {
            data: data.stocks.map((stock) => ({
              symbol: stock.symbol,
              sector: stock.sector,
              purchaseDate: new Date(stock.purchaseDate),
              costBasis: stock.costBasis,
              marketPrice: stock.marketPrice,
              quantity: Math.round(stock.weight * 100),
              // sector lives only in the `sector` column — not duplicated into note.
              note: JSON.stringify({
                weight: stock.weight,
                stopLoss: stock.stopLoss,
                targetPrice: stock.targetPrice,
                beta: stock.beta,
                mdd: stock.mdd,
                managerName: data.managerName,
                website: data.website,
              }),
            })),
          },
        },
        information: {
          createMany: {
            data: [
              {
                month: 'T1',
                vnindexReturn: Math.max(data.vnindexReturn - 0.012, 0),
                recommendReturn: Math.max(data.recommendReturn - 0.028, 0),
              },
              {
                month: 'T2',
                vnindexReturn: data.vnindexReturn,
                recommendReturn: data.recommendReturn,
              },
              ...data.metrics.map((metric) => ({
                month: metric.label,
                vnindexReturn: 0,
                recommendReturn: metric.value,
              })),
            ],
          },
        },
        reasons: {
          createMany: {
            data: data.stocks.map((stock) => ({
              // NOTE: `type` is buy/sell per PortfolioReasonDto's @IsIn(['buy','sell']) contract,
              // not the stock's sector — sector already lives in the stock's `note` JSON.
              type: 'buy',
              symbol: stock.symbol,
              content: stock.thesis,
            })),
          },
        },
        signals: {
          createMany: {
            data: data.stocks.map((stock) => ({
              symbol: stock.symbol,
              signalType: 'portfolio-signal',
              description: stock.signal,
              targetPrice: stock.targetPrice,
              stopLoss: stock.stopLoss,
            })),
          },
        },
      },
      include: {
        plan: true,
        stocks: true,
        information: true,
        reasons: true,
        signals: true,
      },
    });

    console.log(
      `  ✅ Portfolio seeded for "${plan.slug}" with ${portfolio.stocks.length} stocks`,
    );
  }
}

async function main(): Promise<void> {
  console.log('🌱 Starting seed...');
  const forceSeed = process.env.SEED_FORCE === 'true';
  const configuredAdminPassword = process.env.SEED_ADMIN_PASSWORD;

  if (!configuredAdminPassword || configuredAdminPassword.length < 12) {
    throw new Error(
      'SEED_ADMIN_PASSWORD must be set to a strong value before running seed.',
    );
  }

  const existingAdmin = await prisma.user.findFirst({
    where: {
      OR: [
        { email: 'admin@app.com' },
        { email: 'adminHotstock@gmail.com' },
        { email: 'hotstockadmin@gmail.com' },
      ],
    },
    select: { id: true, email: true },
  });

  if (existingAdmin && !forceSeed) {
    const existingAdminLabel = maskEmail(existingAdmin.email);
    console.log(
      `🌱 Admin account already exists (${existingAdminLabel}); refreshing non-destructive seed data.`,
    );
  }

  if (existingAdmin && forceSeed) {
    console.log('🌱 Force seed enabled: existing seed data will be refreshed.');
  }

  for (const plan of plans) {
    const upserted = await prisma.plan.upsert({
      where: { slug: plan.slug },
      update: {
        name: plan.name,
        level: plan.level,
        tagline: plan.tagline,
        badge: plan.badge,
        monthlyPrice: plan.monthlyPrice,
        semiAnnualPrice: plan.semiAnnualPrice,
        originalPrice: plan.originalPrice,
        discountPercent: plan.discountPercent,
        description: plan.description,
        features: plan.features,
        ctaLabel: plan.ctaLabel,
        isPopular: plan.isPopular,
        isActive: plan.isActive,
        sortOrder: plan.sortOrder,
      },
      create: {
        name: plan.name,
        slug: plan.slug,
        level: plan.level,
        tagline: plan.tagline,
        badge: plan.badge,
        monthlyPrice: plan.monthlyPrice,
        semiAnnualPrice: plan.semiAnnualPrice,
        originalPrice: plan.originalPrice,
        discountPercent: plan.discountPercent,
        description: plan.description,
        features: plan.features,
        ctaLabel: plan.ctaLabel,
        isPopular: plan.isPopular,
        isActive: plan.isActive,
        sortOrder: plan.sortOrder,
      },
    });
    console.log(`  ✅ Plan "${upserted.name}" (slug: ${upserted.slug})`);
  }

  await seedPlanVisibilities();

  const adminPassword = configuredAdminPassword;
  const adminPasswordHash = await hashPassword(adminPassword);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@app.com' },
    update: {
      passwordHash: adminPasswordHash,
      role: Role.admin,
      blocked: false,
      confirmed: true,
    },
    create: {
      email: 'admin@app.com',
      username: 'admin',
      role: Role.admin,
      passwordHash: adminPasswordHash,
      blocked: false,
      confirmed: true,
    },
  });
  const adminLabel = maskEmail(admin.email);
  console.log(`  ✅ Admin user "${adminLabel}" (id: ${admin.id})`);

  const customAdminPassword = configuredAdminPassword;
  const customAdminPasswordHash = await hashPassword(customAdminPassword);

  const customAdmin = await prisma.user.upsert({
    where: { email: 'adminHotstock@gmail.com' },
    update: {
      passwordHash: customAdminPasswordHash,
      role: Role.admin,
      blocked: false,
      confirmed: true,
    },
    create: {
      email: 'adminHotstock@gmail.com',
      username: 'adminHotstock',
      fullName: 'Admin HotStock',
      role: Role.admin,
      passwordHash: customAdminPasswordHash,
      blocked: false,
      confirmed: true,
    },
  });
  const customAdminLabel = maskEmail(customAdmin.email);
  console.log(
    `  ✅ Custom Admin user "${customAdminLabel}" (id: ${customAdmin.id})`,
  );

  // Requested admin account
  const requestedAdminPassword = configuredAdminPassword;
  const requestedAdminPasswordHash = await hashPassword(requestedAdminPassword);
  const requestedAdmin = await prisma.user.upsert({
    where: { email: 'hotstockadmin@gmail.com' },
    update: {
      passwordHash: requestedAdminPasswordHash,
      role: Role.admin,
      blocked: false,
      confirmed: true,
    },
    create: {
      email: 'hotstockadmin@gmail.com',
      username: 'hotstockadmin',
      fullName: 'Hotstock Admin',
      role: Role.admin,
      passwordHash: requestedAdminPasswordHash,
      blocked: false,
      confirmed: true,
    },
  });
  const requestedAdminLabel = maskEmail(requestedAdmin.email);
  console.log(
    `  ✅ Requested Admin user "${requestedAdminLabel}" (id: ${requestedAdmin.id})`,
  );

  await seedUsers(configuredAdminPassword);
  await seedPortfolios();

  console.log('🌱 Seed completed successfully!');
}

main()
  .catch((error: unknown) => {
    console.error('❌ Seed failed:', getSafeSeedErrorMessage(error));
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
