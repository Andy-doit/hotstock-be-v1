import { Controller, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ContactService } from './contact.service';
import { SendContactDto } from './dto/send-contact.dto';

@ApiTags('Contact')
@Controller('contact')
export class ContactController {
  constructor(private readonly contactService: ContactService) {}

  @Post()
  @ApiOperation({ summary: 'Gửi yêu cầu liên hệ từ form' })
  @ApiResponse({ status: 200, description: 'Gửi liên hệ thành công' })
  @ApiResponse({ status: 400, description: 'Dữ liệu không hợp lệ' })
  @ApiResponse({ status: 500, description: 'Lỗi server khi gửi email' })
  async sendContact(@Body() sendContactDto: SendContactDto) {
    return this.contactService.sendContact(sendContactDto);
  }
}