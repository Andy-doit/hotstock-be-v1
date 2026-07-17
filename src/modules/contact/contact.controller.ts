import { Controller, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ContactService } from './contact.service';
import { SendContactDto } from './dto/send-contact.dto';
import { ContactSendResultDto } from './dto/contact-response.dto';

@ApiTags('Contact')
@Controller('contact')
export class ContactController {
  constructor(private readonly contactService: ContactService) {}

  @Post()
  @Throttle({ long: { limit: 20, ttl: 600000 } })
  @ApiOperation({ summary: 'Gửi yêu cầu liên hệ từ form' })
  @ApiResponse({
    status: 200,
    description: 'Gửi liên hệ thành công',
    type: ContactSendResultDto,
  })
  @ApiResponse({ status: 400, description: 'Dữ liệu không hợp lệ' })
  @ApiResponse({ status: 500, description: 'Lỗi server khi gửi email' })
  async sendContact(
    @Body() sendContactDto: SendContactDto,
  ): Promise<ContactSendResultDto> {
    return this.contactService.sendContact(sendContactDto);
  }
}
