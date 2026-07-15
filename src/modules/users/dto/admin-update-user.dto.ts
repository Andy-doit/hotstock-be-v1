import {
  IsString,
  IsOptional,
  IsEmail,
  IsBoolean,
  IsEnum,
  MinLength,
  MaxLength,
  Matches,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Role } from '@prisma/client';

/**
 * DTO for admin updating a user's profile.
 * Allows updating fields that regular users cannot change themselves.
 */
export class AdminUpdateUserDto {
  @ApiPropertyOptional({ example: 'johndoe123', description: 'Tên người dùng' })
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

  @ApiPropertyOptional({ example: 'user@example.com', description: 'Email' })
  @IsEmail({}, { message: 'Email không hợp lệ' })
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({
    enum: Role,
    example: 'user',
    description: 'Phân quyền người dùng',
  })
  @IsEnum(Role, { message: 'Role không hợp lệ' })
  @IsOptional()
  role?: Role;

  @ApiPropertyOptional({ example: false, description: 'Trạng thái khóa tài khoản' })
  @IsBoolean({ message: 'blocked phải là boolean' })
  @IsOptional()
  blocked?: boolean;

  @ApiPropertyOptional({ example: true, description: 'Trạng thái xác nhận email' })
  @IsBoolean({ message: 'confirmed phải là boolean' })
  @IsOptional()
  confirmed?: boolean;
}