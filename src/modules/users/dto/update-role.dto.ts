import { IsEnum, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Role } from '@prisma/client';

export class UpdateRoleDto {
  @ApiProperty({ enum: Role, description: 'Role mới' })
  @IsEnum(Role, { message: 'Role không hợp lệ' })
  @IsNotEmpty()
  role: Role;
}
