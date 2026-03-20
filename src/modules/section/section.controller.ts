import {
    BadRequestException,
    Body,
    Controller,
    Delete,
    Get,
    Param,
    ParseIntPipe,
    Post,
    Put,
    Query,
    UseGuards,
    UsePipes,
    ValidationPipe,
} from "@nestjs/common";
import { SectionResponse } from "./types/section-response-interface";
import { SectionService } from "./section.service";
import { CreateSectionDto } from "./dto/create-section.dto";
import { UpdateSectionDto } from "./dto/update-section.dto";
import { AuthGuard } from "@/modules/auth/guards/auth.guard";
import { PermissionsGuard } from "@/modules/roles/guards/permissions.guard";
import { Permissions } from "@/modules/roles/decorator/permissions.decorator";
import { Resource } from "@/modules/roles/enums/resource.enum";
import { Action } from "@/modules/roles/enums/actions.enum";
import { ActivityLogsService } from '@/modules/activity-logs/activity-logs.service';
import { ActivityLogModulePath } from '@/modules/activity-logs/activity-log.constants';
import { User } from '@/modules/auth/decorators/user.decorator';
import { UserEntity } from '@/modules/users/entities/user.entity';
import { SectionEntity } from './section.entity';

@Controller("sections")
export class SectionController {
    constructor(
        private readonly sectionService: SectionService,
        private readonly activityLogsService: ActivityLogsService,
    ) {}

    @Get("page/:slug")
    async getSectionsByPage(
        @Param("slug") slug: string,
        @Query("includePosts") includePosts?: string,
    ): Promise<SectionResponse> {
        const wantsPosts =
            includePosts === undefined || ["true", "1", "yes", "y"].includes(String(includePosts).toLowerCase());
        return this.sectionService.getSectionsForPage(slug, false, wantsPosts);
    }

    @Get()
    async listSections(
        @Query("pageId") pageId?: string,
        @Query("pageSlug") pageSlug?: string,
    ) {
        const parsedPageId = pageId !== undefined ? Number(pageId) : undefined;
        const resolvedPageId =
            typeof parsedPageId === "number" && Number.isInteger(parsedPageId) && parsedPageId > 0
                ? parsedPageId
                : undefined;
        const sections = await this.sectionService.listSections(resolvedPageId, pageSlug);
        return sections.map((section) => ({
            id: section.id,
            pageId: section.pageId,
            pageSlug: section.page.slug,
            blockType: section.blockType,
            title: section.title,
            description: section.description ?? null,
            settings: section.settings ?? null,
            orderIndex: section.orderIndex,
            enabled: section.enabled,
            createdAt: section.createdAt,
            updatedAt: section.updatedAt,
        }));
    }

    @Get(":id/posts")
    async getPublishedPostsBySection(
        @Param("id", ParseIntPipe) id: number,
        @Query("page") page?: string,
        @Query("pageSize") pageSize?: string,
    ) {
        const current = this.parsePositiveIntQuery(page, "page") ?? 1;
        const size = this.parsePositiveIntQuery(pageSize, "pageSize") ?? 20;
        const { items, total } = await this.sectionService.findPublishedPostsBySection(id, current, size);

        return {
            success: true,
            message: "OK",
            page: current,
            pageSize: size,
            total,
            data: items,
        };
    }

    @Get(":id")
    async getSection(@Param("id", ParseIntPipe) id: number) {
        const section = await this.sectionService.findSectionById(id);
        return {
            id: section.id,
            pageId: section.pageId,
            pageSlug: section.page.slug,
            blockType: section.blockType,
            title: section.title,
            description: section.description ?? null,
            settings: section.settings ?? null,
            orderIndex: section.orderIndex,
            enabled: section.enabled,
            createdAt: section.createdAt,
            updatedAt: section.updatedAt,
        };
    }

    @Post()
    @UseGuards(AuthGuard, PermissionsGuard)
    @Permissions({ resource: Resource.Sections, actions: [Action.Create] })
    @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
    async createSection(@User() user: UserEntity, @Body() dto: CreateSectionDto) {
        const section = await this.sectionService.createSection(dto);
        // New section rows link directly to the section detail route.
        await this.activityLogsService.log({
            kind: 'created',
            activity: 'Section created',
            module: ActivityLogModulePath.section,
            resource: 'sections',
            actor: user,
            target: {
                id: section.id,
                type: 'section',
                label: this.toSectionLabel(section),
                url: `/sections/${section.id}`,
            },
        });
        return section;
    }

    @Put(":id")
    @UseGuards(AuthGuard, PermissionsGuard)
    @Permissions({ resource: Resource.Sections, actions: [Action.Update] })
    @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
    async updateSection(@User() user: UserEntity, @Param("id", ParseIntPipe) id: number, @Body() dto: UpdateSectionDto) {
        // Read before update so the activity detail can show the exact block changes.
        const before = await this.sectionService.findSectionById(id);
        const section = await this.sectionService.updateSection(id, dto);
        await this.activityLogsService.log({
            kind: 'updated',
            activity: 'Section updated',
            module: ActivityLogModulePath.section,
            resource: 'sections',
            actor: user,
            target: {
                id: section.id,
                type: 'section',
                label: this.toSectionLabel(section),
                url: `/sections/${section.id}`,
            },
            changes: this.activityLogsService.buildChanges(
                this.toSectionLogSnapshot(before),
                this.toSectionLogSnapshot(section),
            ),
        });
        return section;
    }

    @Delete(":id")
    @UseGuards(AuthGuard, PermissionsGuard)
    @Permissions({ resource: Resource.Sections, actions: [Action.Delete] })
    async deleteSection(@User() user: UserEntity, @Param("id", ParseIntPipe) id: number) {
        // Keep section info before delete so the activity row still has a label.
        const section = await this.sectionService.findSectionById(id);
        await this.sectionService.deleteSection(id);
        await this.activityLogsService.log({
            kind: 'deleted',
            activity: 'Section deleted',
            module: ActivityLogModulePath.section,
            resource: 'sections',
            actor: user,
            target: {
                id: section.id,
                type: 'section',
                label: this.toSectionLabel(section),
                url: `/sections/${section.id}`,
            },
        });
        return { message: "Section deleted" };
    }

    private toSectionLabel(section: SectionEntity): string {
        return section.title?.en?.trim() || section.title?.km?.trim() || section.blockType || `Section ${section.id}`;
    }

    private toSectionLogSnapshot(section: SectionEntity): Record<string, unknown> {
        // Snapshot only fields that are editable from the section form.
        return {
            pageId: section.pageId,
            blockType: section.blockType,
            title: section.title ?? null,
            description: section.description ?? null,
            settings: section.settings ?? null,
            orderIndex: section.orderIndex,
            enabled: section.enabled,
        };
    }

    private parsePositiveIntQuery(value: string | undefined, fieldName: string): number | undefined {
        if (value === undefined || value === "") {
            return undefined;
        }

        const parsed = Number(value);
        if (Number.isInteger(parsed) && parsed > 0) {
            return parsed;
        }

        throw new BadRequestException(`${fieldName} must be a positive integer`);
    }
}
