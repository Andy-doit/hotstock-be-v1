import { Transform } from 'class-transformer';
import {
  Equals,
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  MaxLength,
  Matches,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SendContactDto {
  @ApiProperty({ description: 'Họ và tên người gửi', example: 'Nguyễn Văn A' })
  @IsNotEmpty({ message: 'Họ tên không được để trống' })
  @MaxLength(100, { message: 'Họ tên không được vượt quá 100 ký tự' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  fullname: string;

  @ApiPropertyOptional({ description: 'Email liên hệ', example: 'user@example.com' })
  @IsOptional()
  @IsEmail({}, { message: 'Email không hợp lệ' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  email?: string;

  @ApiPropertyOptional({ description: 'Số điện thoại liên hệ', example: '0912345678' })
  @IsOptional()
  @Matches(/^(0|\+84)[3-9][0-9]{8}$/, { message: 'Số điện thoại không hợp lệ' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  phoneNumber?: string;

  @ApiProperty({ description: 'Nội dung lời nhắn', example: 'Tôi muốn hỏi về dịch vụ...' })
  @IsNotEmpty({ message: 'Lời nhắn không được để trống' })
  @MaxLength(2000, { message: 'Lời nhắn không được vượt quá 2000 ký tự' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  message: string;

  @ApiPropertyOptional({ description: 'Đồng ý nhận thông tin thị trường và sản phẩm', default: false })
  @IsOptional()
  @IsBoolean()
  optIn?: boolean;

  @ApiProperty({
    description: 'Người gửi đồng ý điều khoản sử dụng và cho phép xử lý thông tin cá nhân',
    example: true,
  })
  @Equals(true, { message: 'Bạn cần đồng ý với điều khoản sử dụng và cho phép xử lý thông tin cá nhân' })
  termsAccepted: boolean;
}
