import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WorkingGroupEntity } from './working-group.entity';
import { WorkingGroupService } from './working-group.service';
import { WorkingGroupController } from './working-group.controller';
import { PageEntity } from '@/modules/page/page.entity';
import { RoleModule } from '@/modules/roles/role.module';
import { ActivityLogsModule } from '@/modules/activity-logs/activity-logs.module';
import { SectionModule } from '@/modules/section/section.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([WorkingGroupEntity, PageEntity]),
    RoleModule,
    ActivityLogsModule,
    SectionModule,
  ],
  controllers: [WorkingGroupController],
  providers: [WorkingGroupService],
  exports: [WorkingGroupService],
})
export class WorkingGroupModule {}
