import {
  Injectable,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { SendContactDto } from './dto/send-contact.dto';
import { ContactSendResultDto } from './dto/contact-response.dto';
import {
  getSafeErrorLogMessage,
  getSafeErrorLogStack,
} from '../../common/utils/log-redaction';
import { renderContactNotificationEmail } from '../../common/utils/email-template';

const CONTACT_SEND_FAILURE_MESSAGE =
  'Không thể gửi liên hệ lúc này. Vui lòng thử lại sau.';
@Injectable()
export class ContactService {
  private readonly logger = new Logger(ContactService.name);
  private transporter: nodemailer.Transporter;

  constructor(private readonly configService: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: this.configService.get<string>('app.smtp.host'),
      port: this.configService.get<number>('app.smtp.port'),
      secure: this.configService.get<boolean>('app.smtp.secure', false),
      auth: {
        user: this.configService.get<string>('app.smtp.user'),
        pass: this.configService.get<string>('app.smtp.pass'),
      },
    });
  }

  async sendContact(dto: SendContactDto): Promise<ContactSendResultDto> {
    const { fullname, email, message, phoneNumber, termsAccepted } = dto;
    const fromEmail = this.configService.get<string>('app.smtp.user');
    const toEmail =
      this.configService.get<string>('CONTACT_RECEIVER_EMAIL') || fromEmail;
    const displayedEmail = email || 'Không cung cấp';
    const displayedPhoneNumber = phoneNumber || 'Không cung cấp';
    const subjectFullname = fullname.replace(/[\r\n]+/g, ' ').trim();
    const contactSubject = `[HOTSTOCK] Yêu cầu tư vấn mới từ ${subjectFullname}`;

    const htmlContent = renderContactNotificationEmail(
      [
        { label: 'Họ và tên', value: fullname },
        { label: 'Email', value: displayedEmail },
        { label: 'Số điện thoại', value: displayedPhoneNumber },
        { label: 'Nội dung lời nhắn', value: message },
        {
          label: 'Đồng ý điều khoản và xử lý thông tin cá nhân',
          value: termsAccepted ? 'Có' : 'Không',
        },
      ],
      this.configService.get<string>('app.url'),
    );

    try {
      await this.transporter.sendMail({
        from: this.configService.get<string>('app.smtp.from'),
        to: toEmail,
        replyTo: email ? email.trim() : undefined,
        subject: contactSubject,
        html: htmlContent,
      });

      this.logger.log({
        msg: 'Contact email sent',
        hasReplyTo: Boolean(email),
        hasPhoneNumber: Boolean(phoneNumber),
        termsAccepted,
      });
      return { success: true, message: 'Đã gửi liên hệ thành công' };
    } catch (error: unknown) {
      const message = getSafeErrorLogMessage(error);
      const stack = getSafeErrorLogStack(error);

      this.logger.error(
        'Failed to send contact notification: ' + message,
        stack,
      );
      throw new InternalServerErrorException(CONTACT_SEND_FAILURE_MESSAGE);
    }
  }
}
