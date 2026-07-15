import { IsString, IsOptional, MinLength, MaxLength, Matches } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateUserDto {
  @ApiPropertyOptional({ example: 'johndoe123', description: 'Tên người dùng mới' })
  @IsString()
  @MinLength(3, { message: 'Tên người dùng phải có ít nhất 3 ký tự' })
  @MaxLength(50, { message: 'Tên người dùng không được quá 50 ký tự' })
  @IsOptional()
  username?: string;

  @ApiPropertyOptional({ example: 'Nguyễn Văn A', description: 'Tên đầy đủ' })
  @IsString()
  @MaxLength(100, { message: 'Tên đầy đủ không được quá 100 ký tự' })
  @IsOptional()
  fullName?: string;

  @ApiPropertyOptional({ example: '0912345678', description: 'Số điện thoại' })
  @IsString()
  @Matches(/^[0-9+\-() ]{8,20}$/, { message: 'Số điện thoại không hợp lệ' })
  @IsOptional()
  phoneNumber?: string;
}