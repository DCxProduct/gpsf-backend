import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TestimonialEntity } from './testimonial.entity';
import { TestimonialService } from './testimonial.service';
import { TestimonialController } from './testimonial.controller';
import { RoleModule } from '@/modules/roles/role.module';
import { ActivityLogsModule } from '@/modules/activity-logs/activity-logs.module';

@Module({
  imports: [TypeOrmModule.forFeature([TestimonialEntity]), RoleModule, ActivityLogsModule],
  controllers: [TestimonialController],
  providers: [TestimonialService],
  exports: [TestimonialService],
})
export class TestimonialModule {}
