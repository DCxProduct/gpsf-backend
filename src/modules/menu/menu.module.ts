import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MenuEntity } from '@/modules/menu/menu.entity';
import { MenuItemEntity } from '@/modules/menu/menuItem.entity';
import { MenuService } from '@/modules/menu/menu.service';
import { MenuController } from '@/modules/menu/menu.controller';
import { RoleModule } from '@/modules/roles/role.module';
import { ActivityLogsModule } from '@/modules/activity-logs/activity-logs.module';

@Module({
  imports: [TypeOrmModule.forFeature([MenuEntity, MenuItemEntity]), RoleModule, ActivityLogsModule],
  controllers: [MenuController],
  providers: [MenuService],
  exports: [MenuService],
})
export class MenuModule {}
