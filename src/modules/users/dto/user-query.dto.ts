import { IsInt, IsOptional, IsEnum, IsBoolean, IsString, Min, Max } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Role } from '@prisma/client';

export class UserListQueryDto {
  @ApiPropertyOptional({ example: 1 })
  @IsInt()
  @Min(1)
  @IsOptional()
  @Transform(({ value }) => (value ? parseInt(value as string, 10) : 1))
  page?: number;

  @ApiPropertyOptional({ example: 20 })
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  @Transform(({ value }) => (value ? parseInt(value as string, 10) : 20))
  limit?: number;

  @ApiPropertyOptional({ enum: Role })
  @IsEnum(Role)
  @IsOptional()
  role?: Role;

  @ApiPropertyOptional({ example: false })
  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  blocked?: boolean;

  @ApiPropertyOptional({ example: 'admin', description: 'Tìm kiếm theo email hoặc username' })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({
    example: 'createdAt',
    description: 'Trường sắp xếp',
    enum: ['createdAt', 'email', 'username', 'role'],
  })
  @IsString()
  @IsOptional()
  sort?: string;

  @ApiPropertyOptional({
    example: 'desc',
    description: 'Thứ tự sắp xếp',
    enum: ['asc', 'desc'],
  })
  @IsString()
  @IsOptional()
  order?: 'asc' | 'desc';
}