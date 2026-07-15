import { PartialType, OmitType } from '@nestjs/swagger';
import { CreatePlanDto } from './create-plan.dto';

/**
 * UpdatePlanDto — all fields optional EXCEPT slug and level
 * which are immutable after creation.
 */
export class UpdatePlanDto extends PartialType(
  OmitType(CreatePlanDto, ['slug', 'level'] as const),
) {}
