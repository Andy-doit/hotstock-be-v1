import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { CleanupService } from './cleanup.service';


@Module({
  imports: [ScheduleModule.forRoot()],
  providers: [CleanupService],
})
export class JobsModule {}