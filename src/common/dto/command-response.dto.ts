import { ApiProperty } from '@nestjs/swagger';

export class CommandMessageResponseDto {
  @ApiProperty({ example: 'Thao tác thành công' })
  message: string;
}
