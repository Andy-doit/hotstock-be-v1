import { escapeHtmlText } from './html-escape';

const BRAND_NAME = 'HOTSTOCK';
const BRAND_TAGLINE = 'Đầu tư thông minh, lợi nhuận bền vững';

type EmailField = {
  label: string;
  value: string;
};

type BrandedEmailOptions = {
  title: string;
  preheader: string;
  intro?: string;
  bodyHtml: string;
  footerNote?: string;
  appUrl?: string | null;
};

const normalizeAppUrl = (value?: string | null): string => {
  return value?.trim().replace(/\/+$/, '') ?? '';
};

const logoHtml = (appUrl?: string | null): string => {
  const normalizedAppUrl = normalizeAppUrl(appUrl);
  const imageUrl = normalizedAppUrl ? `${normalizedAppUrl}/logo2.svg` : '';

  return `
    <div style="text-align:center;margin-bottom:18px;">
      ${
        imageUrl
          ? `<img src="${escapeHtmlText(imageUrl)}" alt="${BRAND_NAME}" width="160" style="display:inline-block;max-width:160px;height:auto;margin-bottom:10px;" />`
          : ''
      }
      <div style="font-family:Arial,Helvetica,sans-serif;font-size:26px;line-height:1;font-weight:700;letter-spacing:1px;color:#ffffff;">${BRAND_NAME}</div>
      <div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.5;color:#f5d0fe;margin-top:8px;">${BRAND_TAGLINE}</div>
    </div>
  `;
};

export const renderBrandedEmail = ({
  title,
  preheader,
  intro,
  bodyHtml,
  footerNote,
  appUrl,
}: BrandedEmailOptions): string => {
  const safeTitle = escapeHtmlText(title);
  const safePreheader = escapeHtmlText(preheader);
  const safeIntro = intro ? escapeHtmlText(intro) : '';
  const currentYear = new Date().getFullYear();

  return `<!doctype html>
<html lang="vi">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="color-scheme" content="light">
    <meta name="supported-color-schemes" content="light">
    <title>${safeTitle}</title>
  </head>
  <body style="margin:0;padding:0;background:#f6f2ff;font-family:Arial,Helvetica,sans-serif;color:#111827;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${safePreheader}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f6f2ff;padding:32px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" bgcolor="#ffffff" style="max-width:680px;border-collapse:separate;border-spacing:0;background:#ffffff;border:1px solid #d8b4fe;border-radius:18px;overflow:hidden;box-shadow:0 18px 45px rgba(76,29,149,.12);">
            <tr>
              <td bgcolor="#2e1065" style="padding:30px 28px 24px;background:#2e1065;background-image:linear-gradient(135deg,#2e1065 0%,#581c87 54%,#7e22ce 100%);border-bottom:1px solid #6b21a8;">
                ${logoHtml(appUrl)}
                <div style="width:56px;height:3px;margin:0 auto 18px;background:#f0abfc;border-radius:999px;"></div>
                <h1 style="margin:0;text-align:center;font-family:Arial,Helvetica,sans-serif;font-size:25px;line-height:1.4;font-weight:700;color:#ffffff;">${safeTitle}</h1>
                ${
                  safeIntro
                    ? `<p style="margin:12px auto 0;max-width:560px;text-align:center;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#f3e8ff;">${safeIntro}</p>`
                    : ''
                }
              </td>
            </tr>
            <tr>
              <td bgcolor="#ffffff" style="background:#ffffff;padding:28px;color:#111827;">
                ${bodyHtml}
              </td>
            </tr>
            <tr>
              <td bgcolor="#f8f5ff" style="background:#f8f5ff;padding:20px 28px;border-top:1px solid #ede9fe;text-align:center;">
                <p style="margin:0 0 8px;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.6;color:#4c1d95;">
                  ${footerNote ? escapeHtmlText(footerNote) : 'Email này được gửi từ hệ thống HOTSTOCK.'}
                </p>
                <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;color:#5b21b6;">
                  © ${currentYear} ${BRAND_NAME}. ${BRAND_TAGLINE}.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
};

export const renderOtpEmail = (
  otp: number | string,
  appUrl?: string | null,
): string => {
  const safeOtp = escapeHtmlText(String(otp));

  return renderBrandedEmail({
    title: 'Mã OTP khôi phục mật khẩu',
    preheader: `Mã OTP của bạn là ${safeOtp}. Mã có hiệu lực trong 10 phút.`,
    intro:
      'Sử dụng mã xác minh bên dưới để tiếp tục khôi phục mật khẩu tại HOTSTOCK.',
    appUrl,
    footerNote:
      'Nếu bạn không yêu cầu khôi phục mật khẩu, vui lòng bỏ qua email này.',
    bodyHtml: `
      <p style="margin:0 0 18px;font-size:15px;line-height:1.7;color:#334155;">
        Xin chào, chúng tôi đã nhận được yêu cầu khôi phục mật khẩu cho tài khoản của bạn.
      </p>
      <div style="margin:26px auto;padding:22px 18px;max-width:360px;text-align:center;background:#ede9fe;border:1px solid #8b5cf6;border-radius:18px;">
        <div style="font-size:12px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;color:#4c1d95;margin-bottom:10px;">Mã xác minh</div>
        <div style="font-family:'Courier New',monospace;font-size:42px;line-height:1;font-weight:600;letter-spacing:8px;color:#2e1065;">${safeOtp}</div>
      </div>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:18px;background:#fff7ed;border:1px solid #fb923c;border-radius:14px;">
        <tr>
          <td style="padding:14px 16px;font-size:14px;line-height:1.65;color:#7c2d12;">
            Mã OTP có hiệu lực trong <strong>10 phút</strong>. Không chia sẻ mã này với bất kỳ ai, kể cả người tự xưng là nhân viên HOTSTOCK.
          </td>
        </tr>
      </table>
    `,
  });
};

export const renderContactNotificationEmail = (
  fields: EmailField[],
  appUrl?: string | null,
): string => {
  const rows = fields
    .map(
      ({ label, value }) => `
        <tr>
          <td style="padding:14px 16px;border-bottom:1px solid #ede9fe;width:240px;vertical-align:top;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.45;font-weight:700;color:#4c1d95;text-transform:uppercase;letter-spacing:.25px;">${escapeHtmlText(label)}</td>
          <td style="padding:14px 16px;border-bottom:1px solid #ede9fe;vertical-align:top;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#111827;white-space:pre-wrap;">${escapeHtmlText(value)}</td>
        </tr>
      `,
    )
    .join('');

  return renderBrandedEmail({
    title: 'Yêu cầu tư vấn mới',
    preheader: 'Có một khách hàng vừa gửi thông tin liên hệ qua HOTSTOCK.',
    intro:
      'Thông tin liên hệ mới từ website đã sẵn sàng để đội ngũ chăm sóc tiếp nhận.',
    appUrl,
    footerNote: 'Hãy phản hồi sớm để giữ trải nghiệm khách hàng chuyên nghiệp.',
    bodyHtml: `
      <p style="margin:0 0 18px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#374151;">
        Bạn nhận được một yêu cầu liên hệ mới. Thông tin chi tiết:
      </p>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;background:#fdfcff;border:1px solid #ede9fe;border-radius:14px;overflow:hidden;">
        ${rows}
      </table>
    `,
  });
};
