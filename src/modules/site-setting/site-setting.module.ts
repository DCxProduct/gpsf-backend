import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SiteSettingController } from '@/modules/site-setting/site-setting.controller';
import { SiteSettingService } from '@/modules/site-setting/site-setting.service';
import { SiteSettingEntity } from '@/modules/site-setting/site-setting.entity';
import { RoleModule } from '@/modules/roles/role.module';

@Module({
  imports: [TypeOrmModule.forFeature([SiteSettingEntity]), RoleModule],
  controllers: [SiteSettingController],
  providers: [SiteSettingService],
  exports: [SiteSettingService],
})
export class SiteSettingModule {}
