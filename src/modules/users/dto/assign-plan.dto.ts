import { IsInt, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AssignPlanDto {
  @ApiProperty({ example: 1, description: 'ID của gói cần gán' })
  @IsInt({ message: 'planId phải là số nguyên' })
  @IsNotEmpty()
  planId: number;
}
