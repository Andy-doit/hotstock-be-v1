import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export interface ApiSuccessEnvelope<T = unknown> {
  success: true;
  data: T | null;
  message?: string;
  meta?: Record<string, unknown>;
}

export class ApiSuccessEnvelopeDto {
  @ApiProperty({ example: true })
  success: true;

  @ApiProperty({
    nullable: true,
    description:
      'Endpoint payload. Existing DTO shape is preserved inside data.',
  })
  data: unknown;

  @ApiPropertyOptional({
    description:
      'Human-readable success message when the endpoint returns one.',
  })
  message?: string;

  @ApiPropertyOptional({
    description: 'Pagination or cursor metadata when available.',
    type: 'object',
    additionalProperties: true,
  })
  meta?: Record<string, unknown>;
}
