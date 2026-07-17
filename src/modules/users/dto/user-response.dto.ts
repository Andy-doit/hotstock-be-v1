import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Role } from '@prisma/client';

export class UserPlanDto {
  @ApiProperty() id: number;
  @ApiProperty() name: string;
  @ApiProperty() slug: string;
  @ApiProperty() level: number;
}

export class UserResponseDto {
  @ApiProperty() id: number;
  @ApiProperty() email: string;
  @ApiProperty() username: string;
  @ApiPropertyOptional() fullName: string | null;
  @ApiPropertyOptional() phoneNumber: string | null;
  @ApiProperty({ enum: Role }) role: Role;
  @ApiProperty() provider: string;
  @ApiProperty() confirmed: boolean;
  @ApiProperty() blocked: boolean;
  @ApiProperty() termsAccepted: boolean;
  @ApiPropertyOptional() termsAcceptedAt: Date | null;
  @ApiProperty() personalDataConsent: boolean;
  @ApiPropertyOptional() personalDataConsentAt: Date | null;
  @ApiPropertyOptional({ type: UserPlanDto }) plan: UserPlanDto | null;
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;
}

export class PaginatedUsersDto {
  @ApiProperty({ type: [UserResponseDto] }) data: UserResponseDto[];
  @ApiProperty() total: number;
  @ApiProperty() page: number;
  @ApiProperty() limit: number;
  @ApiProperty() totalPages: number;
}
