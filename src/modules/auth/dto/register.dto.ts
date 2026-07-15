import {
  Equals,
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ example: 'user@example.com', description: 'Email đăng ký' })
  @IsEmail({}, { message: 'Email không hợp lệ' })
  email: string;

  @ApiProperty({ example: 'johndoe', description: 'Tên người dùng' })
  @IsString()
  @MinLength(3, { message: 'Tên người dùng phải có ít nhất 3 ký tự' })
  @MaxLength(50, { message: 'Tên người dùng không được quá 50 ký tự' })
  username: string;

  @ApiPropertyOptional({ example: 'Nguyễn Văn A', description: 'Họ và tên' })
  @IsOptional()
  @IsString()
  @MinLength(2, { message: 'Họ và tên phải có ít nhất 2 ký tự' })
  @MaxLength(100, { message: 'Họ và tên không được quá 100 ký tự' })
  fullName?: string;

  @ApiPropertyOptional({ example: '0912345678', description: 'Số điện thoại' })
  @IsOptional()
  @IsString()
  @Matches(/^(0|\+84)[3-9][0-9]{8}$/, { message: 'Số điện thoại không hợp lệ' })
  phoneNumber?: string;

  @ApiProperty({ example: 'password123', description: 'Mật khẩu tối thiểu 8 ký tự' })
  @IsString()
  @MinLength(8, { message: 'Mật khẩu phải có ít nhất 8 ký tự' })
  password: string;

  @ApiProperty({ example: 'password123', description: 'Xác nhận mật khẩu' })
  @IsString()
  @MinLength(8, { message: 'Xác nhận mật khẩu phải có ít nhất 8 ký tự' })
  confirmPassword: string;

  @ApiProperty({
    example: true,
    description: 'Người dùng đồng ý điều khoản sử dụng và cho phép xử lý thông tin cá nhân',
  })
  @Equals(true, { message: 'Bạn cần đồng ý với điều khoản sử dụng và cho phép xử lý thông tin cá nhân' })
  termsAccepted: boolean;
}
