import { ApiProperty } from '@nestjs/swagger';

export class ResetTokenResponseDto {
  @ApiProperty({
    description: 'Token dùng một lần để đặt lại mật khẩu',
    example: 'reset-token-value',
  })
  reset_token: string;
}
