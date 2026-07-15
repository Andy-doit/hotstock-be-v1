import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class PortfolioQueryDto {
  @ApiProperty({ example: 'gold', description: 'Slug gói' })
  @IsString()
  @IsNotEmpty({ message: 'Vui lòng chọn gói' })
  plan: string;
}
