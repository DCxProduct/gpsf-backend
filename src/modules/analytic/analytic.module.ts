import { Module } from '@nestjs/common';
import { AuthModule } from '@/modules/auth/auth.module';
import { AnalyticController } from '@/modules/analytic/analytic.controller';
import { AnalyticService } from '@/modules/analytic/analytic.service';

@Module({
  imports: [AuthModule],
  controllers: [AnalyticController],
  providers: [AnalyticService],
  exports: [AnalyticService],
})
export class AnalyticModule {}
