import { ApiProperty } from '@nestjs/swagger';

export class ContactSendResultDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'Đã gửi liên hệ thành công' })
  message: string;
}
