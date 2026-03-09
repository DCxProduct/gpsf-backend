import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ActivityLogEntity } from './activity-log.entity';
import { ActivityLogsController } from './activity-logs.controller';
import { ActivityLogsService } from './activity-logs.service';
import { RoleModule } from '@/modules/roles/role.module';

@Module({
  imports: [TypeOrmModule.forFeature([ActivityLogEntity]), forwardRef(() => RoleModule)],
  controllers: [ActivityLogsController],
  providers: [ActivityLogsService],
  exports: [ActivityLogsService],
})
export class ActivityLogsModule {}
