import {
  IsInt,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsString,
  Min,
  Max,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Role } from '@prisma/client';

const parseIntOrDefault = (value: unknown, fallback: number): number => {
  if (typeof value === 'number') {
    return value;
  }

  if (typeof value !== 'string' || value.trim() === '') {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
};

const parseOptionalBoolean = (value: unknown): boolean | string | undefined => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (value === true || value === false) {
    return value;
  }

  if (value === 'true') {
    return true;
  }

  if (value === 'false') {
    return false;
  }

  return typeof value === 'string' ? value : undefined;
};

export class UserListQueryDto {
  @ApiPropertyOptional({ example: 1 })
  @IsInt()
  @Min(1)
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => parseIntOrDefault(value, 1))
  page?: number;

  @ApiPropertyOptional({ example: 20 })
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => parseIntOrDefault(value, 20))
  limit?: number;

  @ApiPropertyOptional({ enum: Role })
  @IsEnum(Role)
  @IsOptional()
  role?: Role;

  @ApiPropertyOptional({ example: false })
  @IsBoolean()
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => parseOptionalBoolean(value))
  blocked?: boolean;

  @ApiPropertyOptional({
    example: 'admin',
    description: 'Tìm kiếm theo email hoặc username',
  })
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
