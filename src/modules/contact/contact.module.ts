import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ContactEntity } from "./contact.entity";
import { ContactController } from "./contact.controller";
import { ContactService } from "./contact.service";
import { ActivityLogsModule } from '@/modules/activity-logs/activity-logs.module';

@Module({
  imports: [TypeOrmModule.forFeature([ContactEntity]), ActivityLogsModule],
  controllers: [ContactController],
  providers: [ContactService],
  exports: [ContactService],
})
export class ContactModule {}
