import { BadRequestException, Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put, Query, UseGuards, UsePipes, ValidationPipe } from "@nestjs/common";
import { CategoryService } from "@/modules/category/category.service";
import { CreateCategoryDto } from "@/modules/category/dto/create-category.dto";
import { UpdateCategoryDto } from "@/modules/category/dto/update-category.dto";
import { AuthGuard } from "@/modules/auth/guards/auth.guard";
import { PermissionsGuard } from "@/modules/roles/guards/permissions.guard";
import { Permissions } from "@/modules/roles/decorator/permissions.decorator";
import { Resource } from "@/modules/roles/enums/resource.enum";
import { Action } from "@/modules/roles/enums/actions.enum";
import { User } from "@/modules/auth/decorators/user.decorator";
import { UserEntity } from "@/modules/users/entities/user.entity";
import { CategoryEntity } from "@/modules/category/category.entity";
import { PostService } from "@/modules/post/post.service";
import { PostEntity } from "@/modules/post/post.entity";
import { CategoryRelationSummary } from "@/modules/category/category.service";
import { ActivityLogsService } from '@/modules/activity-logs/activity-logs.service';
import { ActivityLogModulePath } from '@/modules/activity-logs/activity-log.constants';


@Controller("categories")
export class CategoryController {
    constructor(
        private categoryService: CategoryService,
        private readonly postService: PostService,
        private readonly activityLogsService: ActivityLogsService,
    ) {}

    // Accept only 'en' or 'km' (case-insensitive); anything else is ignored.
    private normalizeLang(lang?: string): 'en' | 'km' | undefined {
        // No query provided, so keep the default behavior.
        if (!lang) {
            return undefined;
        }

        // Normalize to lowercase so EN/en/KM/km all work.
        const lower = lang.toLowerCase();
        // Accept English.
        if (lower === 'en') {
            return 'en';
        }

        // Accept Khmer.
        if (lower === 'km') {
            return 'km';
        }

        // Any other value is treated as "no language".
        return undefined;
    }

    private pickLocalizedField(
        value: { en?: string; km?: string } | null | undefined,
        lang?: 'en' | 'km',
    ): string | null {
        if (!value) return null;
        if (lang === 'km') return value.km ?? value.en ?? null;
        return value.en ?? value.km ?? null;
    }

    private parseBooleanQuery(value: string | undefined, fieldName: string): boolean | undefined {
        if (value === undefined || value === '') {
            return undefined;
        }

        const normalized = String(value).trim().toLowerCase();
        if (normalized === 'true' || normalized === '1') {
            return true;
        }
        if (normalized === 'false' || normalized === '0') {
            return false;
        }

        throw new BadRequestException(`${fieldName} must be true or false`);
    }

    private parsePositiveIntQuery(value: string | undefined, fieldName: string): number | undefined {
        if (value === undefined || value === '') {
            return undefined;
        }

        const parsed = Number(value);
        if (Number.isInteger(parsed) && parsed > 0) {
            return parsed;
        }

        throw new BadRequestException(`${fieldName} must be a positive integer`);
    }

    private toCategoryResponse(category: CategoryEntity, lang?: 'en' | 'km') {
        return this.toCategoryResponseWithSummary(category, lang);
    }

    private toCategoryResponseWithSummary(
        category: CategoryEntity,
        lang?: 'en' | 'km',
        summary?: CategoryRelationSummary,
    ) {
        const localized = lang === 'en' || lang === 'km';
        const relation = summary ?? {
            totalPosts: 0,
            totalPages: 0,
            totalSections: 0,
            pages: [],
            sections: [],
        };
        return {
            id: category.id,
            name: localized ? this.pickLocalizedField(category.name, lang) : category.name,
            description: localized ? this.pickLocalizedField(category.description, lang) : category.description,
            // These explicit links drive the page-specific filter sidebar in CMS/frontend.
            pageIds: category.pages?.map((page) => page.id) ?? [],
            pages:
                category.pages?.map((page) => ({
                    id: page.id,
                    title: localized ? this.pickLocalizedField(page.title, lang) : page.title,
                    slug: page.slug,
                })) ?? [],
            createdAt: category.createdAt,
            updatedAt: category.updatedAt,
            createdBy: category.createdBy
                ? { id: category.createdBy.id, displayName: category.createdBy.username, email: category.createdBy.email }
                : null,
            relation,
        };
    }

    @Get()
    async findAll(@Query('lang') lang?: string, @Query('pageId') pageId?: string) {
        const normalized = this.normalizeLang(lang);
        const pageFilter = this.parsePositiveIntQuery(pageId, 'pageId');
        const categories = await this.categoryService.findAll(pageFilter);
        const summaryMap = await this.categoryService.getRelationSummaries(categories.map((c) => c.id));
        return categories.map((c) =>
            this.toCategoryResponseWithSummary(c, normalized, summaryMap.get(c.id)),
        );
    }

    @Get(':id')
    async findOne(@Param('id', ParseIntPipe) id: number, @Query('lang') lang?: string) {
        const normalized = this.normalizeLang(lang);
        const category = await this.categoryService.findOne(id);
        const summaryMap = await this.categoryService.getRelationSummaries([category.id]);
        return this.toCategoryResponseWithSummary(category, normalized, summaryMap.get(category.id));
    }

    @Get(':id/posts')
    findPostsByCategory(
        @Param('id', ParseIntPipe) id: number,
        @Query('isFeatured') isFeatured?: string,
    ) {
        const featuredFilter = this.parseBooleanQuery(isFeatured, 'isFeatured');
        return this.postService
            .findByCategory(id, featuredFilter)
            .then((items) => items.map((post) => this.toPostResponse(post)));
    }

    @Post()
    @UseGuards(AuthGuard, PermissionsGuard)
    @Permissions({ resource: Resource.Categories, actions: [Action.Create] })
    @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
    create(@User() user: UserEntity, @Body() dto: CreateCategoryDto) {
        return this.categoryService
            .create(user, dto)
            .then(async (c) => {
                // Log after create so the table only shows successful category writes.
                await this.activityLogsService.log({
                    kind: 'created',
                    activity: 'Category created',
                    module: ActivityLogModulePath.category,
                    resource: 'categories',
                    actor: user,
                    target: {
                        id: c.id,
                        type: 'category',
                        label: this.toCategoryLabel(c),
                        url: `/categories/${c.id}`,
                    },
                });
                return this.toCategoryResponse(c);
            });
    }
    @Put(':id')
    @UseGuards(AuthGuard, PermissionsGuard)
    @Permissions({ resource: Resource.Categories, actions: [Action.Update] })
    @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
    async update(@User() user: UserEntity, @Param('id', ParseIntPipe) id: number, @Body() dto: UpdateCategoryDto) {
        // Capture the previous category so update detail can show before/after values.
        const before = await this.categoryService.findOne(id);
        return this.categoryService
            .update(id, dto)
            .then(async (c) => {
                await this.activityLogsService.log({
                    kind: 'updated',
                    activity: 'Category updated',
                    module: ActivityLogModulePath.category,
                    resource: 'categories',
                    actor: user,
                    target: {
                        id: c.id,
                        type: 'category',
                        label: this.toCategoryLabel(c),
                        url: `/categories/${c.id}`,
                    },
                    changes: this.activityLogsService.buildChanges(
                        this.toCategoryLogSnapshot(before),
                        this.toCategoryLogSnapshot(c),
                    ),
                });
                return this.toCategoryResponse(c);
            });
    }

    @Delete(':id')
    @UseGuards(AuthGuard, PermissionsGuard)
    @Permissions({ resource: Resource.Categories, actions: [Action.Delete] })
    async remove(@User() user: UserEntity, @Param('id', ParseIntPipe) id: number) {
        // Keep a copy of the category label before delete for the log row.
        const category = await this.categoryService.findOne(id);
        await this.categoryService.remove(id);
        await this.activityLogsService.log({
            kind: 'deleted',
            activity: 'Category deleted',
            module: ActivityLogModulePath.category,
            resource: 'categories',
            actor: user,
            target: {
                id: category.id,
                type: 'category',
                label: this.toCategoryLabel(category),
                url: `/categories/${category.id}`,
            },
        });
        return { message: 'Category deleted' };
    }

    private toPostResponse(post: PostEntity) {
        const documents = post.documents ?? null;
        const documentEn = documents?.en ?? null;
        const documentKm = documents?.km ?? null;

        return {
            id: post.id,
            title: post.title,
            slug: post.slug,
            content: post.content,
            status: post.status,
            coverImage: post.coverImage ?? null,
            document: documentEn?.url ?? documentKm?.url ?? null,
            documentThumbnail: documentEn?.thumbnailUrl ?? documentKm?.thumbnailUrl ?? null,
            documents: {
                en: documentEn,
                km: documentKm,
            },
            link: post.link ?? null,
            createdAt: post.createdAt,
            updatedAt: post.updatedAt,
            author: post.author
                ? { id: post.author.id, displayName: post.author.username, email: post.author.email }
                : null,
            category: post.category ? { id: post.category.id, name: post.category.name } : null,
            page: post.page ? { id: post.page.id, title: post.page.title, slug: post.page.slug } : null,
        };
    }

    private toCategoryLabel(category: CategoryEntity): string {
        return category.name?.en?.trim() || category.name?.km?.trim() || `Category ${category.id}`;
    }

    private toCategoryLogSnapshot(category: CategoryEntity): Record<string, unknown> {
        // Only include editable fields in the activity diff.
        return {
            name: category.name ?? null,
            description: category.description ?? null,
            pageIds: category.pages?.map((page) => page.id) ?? [],
        };
    }
}
