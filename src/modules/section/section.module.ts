import { Module, forwardRef } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { SectionController } from "./section.controller";
import { SectionService } from "./section.service";
import { SectionEntity } from "./section.entity";
import { PageModule } from "@/modules/page/page.module";
import { PostEntity } from "@/modules/post/post.entity";
import { CategoryEntity } from "@/modules/category/category.entity";
import { RoleModule } from "@/modules/roles/role.module";
import { ActivityLogsModule } from '@/modules/activity-logs/activity-logs.module';

@Module({
    imports: [TypeOrmModule.forFeature([SectionEntity, PostEntity, CategoryEntity]), forwardRef(() => PageModule), RoleModule, ActivityLogsModule],
    controllers: [SectionController],
    providers: [SectionService],
    exports: [SectionService],
})
export class SectionModule {}
