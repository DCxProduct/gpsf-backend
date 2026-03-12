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
  UploadedFiles,
  UseGuards,
  UseInterceptors,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { PostService } from '@/modules/post/post.service';
import { CreatePostDto } from '@/modules/post/dto/create-post.dto';
import { UpdatePostDto } from '@/modules/post/dto/update-post.dto';
import { AuthGuard } from '@/modules/auth/guards/auth.guard';
import { PermissionsGuard } from '@/modules/roles/guards/permissions.guard';
import { Permissions } from '@/modules/roles/decorator/permissions.decorator';
import { Resource } from '@/modules/roles/enums/resource.enum';
import { Action } from '@/modules/roles/enums/actions.enum';
import { User } from '@/modules/auth/decorators/user.decorator';
import { UserEntity } from '@/modules/users/entities/user.entity';
import type { UploadedFilePayload } from '@/types/uploaded-file.type';
import { PostEntity } from '@/modules/post/post.entity';
import { ActivityLogsService } from '@/modules/activity-logs/activity-logs.service';
import { ActivityLogModulePath } from '@/modules/activity-logs/activity-log.constants';

@Controller('posts')
export class PostController {
  constructor(
    private readonly postService: PostService,
    private readonly activityLogsService: ActivityLogsService,
  ) {}

  @Get()
  async findAll(
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
    @Query('isFeatured') isFeatured?: string,
    @Query('title') title?: string,
    @Query('pageId') pageId?: string,
    @Query('sectionId') sectionId?: string,
  ) {
    const current = Math.max(Number(page) || 1, 1);
    const size = Math.min(Math.max(Number(pageSize) || 20, 1), 50);
    const featuredFilter = this.parseBooleanQuery(isFeatured, 'isFeatured');
    const pageFilter = this.parsePositiveIntQuery(pageId, 'pageId');
    const sectionFilter = this.parsePositiveIntQuery(sectionId, 'sectionId');
    const { items, total } = await this.postService.findAll(
      current,
      size,
      featuredFilter,
      title,
      pageFilter,
      sectionFilter,
    );
    const data = items.map((post) => this.toPostResponse(post));
    return {
      success: true,
      message: 'OK',
      page: current,
      pageSize: size,
      total,
      data,
    };
  }

  @Get('category/:categoryId')
  findByCategory(
    @Param('categoryId', ParseIntPipe) categoryId: number,
    @Query('isFeatured') isFeatured?: string,
  ) {
    const featuredFilter = this.parseBooleanQuery(isFeatured, 'isFeatured');
    return this.postService
      .findByCategory(categoryId, featuredFilter)
      .then((items) => items.map((post) => this.toPostResponse(post)));
  }

  @Get('search')
  async search(
    @Query('q') q?: string,
    @Query('isFeatured') isFeatured?: string,
  ) {
    const keyword = q?.trim();
    if (!keyword) {
      throw new BadRequestException('q is required');
    }

    const featuredFilter = this.parseBooleanQuery(isFeatured, 'isFeatured');
    const { items, total } = await this.postService.searchByTitle(keyword, featuredFilter);
    const data = items.map((post) => this.toPostResponse(post));
    return {
      success: true,
      message: 'OK',
      total,
      data,
    };
  }

  @Get('slug/:slug')
  findOneBySlug(@Param('slug') slug: string) {
    return this.postService.findOneBySlug(slug).then((post) => this.toPostResponse(post));
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.postService.findOne(id).then((post) => this.toPostResponse(post));
  }

  @Post()
  @UseGuards(AuthGuard, PermissionsGuard)
  @Permissions({ resource: Resource.Posts, actions: [Action.Create] })
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'coverImage', maxCount: 1 },
        { name: 'document', maxCount: 1 },
        { name: 'documentEn', maxCount: 1 },
        { name: 'documentKm', maxCount: 1 },
      ],
      {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 }, // 10MB per file
      },
    ),
  )
  create(
    @User() user: UserEntity,
    @Body() dto: CreatePostDto,
    @UploadedFiles()
    files?: {
      coverImage?: UploadedFilePayload[];
      document?: UploadedFilePayload[];
      documentEn?: UploadedFilePayload[];
      documentKm?: UploadedFilePayload[];
    },
  ) {
    const coverImage = files?.coverImage?.[0];
    const document = files?.document?.[0];
    const documentEn = files?.documentEn?.[0];
    const documentKm = files?.documentKm?.[0];
    return this.postService
      .create(user, dto, { coverImage, document, documentEn, documentKm })
      .then(async (post) => {
        // Save a simple activity row after the post is created successfully.
        await this.activityLogsService.log({
          kind: 'created',
          activity: 'Post created',
          module: ActivityLogModulePath.post,
          resource: 'posts',
          actor: user,
          target: {
            id: post.id,
            type: 'post',
            label: this.toPostLabel(post),
            url: `/posts/${post.id}`,
          },
        });
        return this.toPostResponse(post);
      });
  }

  @Put(':id')
  @UseGuards(AuthGuard, PermissionsGuard)
  @Permissions({ resource: Resource.Posts, actions: [Action.Update] })
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'coverImage', maxCount: 1 },
        { name: 'document', maxCount: 1 },
        { name: 'documentEn', maxCount: 1 },
        { name: 'documentKm', maxCount: 1 },
      ],
      {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 },
      },
    ),
  )
  update(
    @User() user: UserEntity,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePostDto,
    @UploadedFiles()
    files?: {
      coverImage?: UploadedFilePayload[];
      document?: UploadedFilePayload[];
      documentEn?: UploadedFilePayload[];
      documentKm?: UploadedFilePayload[];
    },
  ) {
    const coverImage = files?.coverImage?.[0];
    const document = files?.document?.[0];
    const documentEn = files?.documentEn?.[0];
    const documentKm = files?.documentKm?.[0];
    return this.postService
      // Load the old post first so we can build before/after changes for the detail view.
      .findOne(id)
      .then((before) => ({ before, snapshot: this.toPostLogSnapshot(before) }))
      .then(({ before, snapshot }) =>
        this.postService
          .update(id, dto, { coverImage, document, documentEn, documentKm })
          .then(async (post) => {
            await this.activityLogsService.log({
              kind: 'updated',
              activity: 'Post updated',
              module: ActivityLogModulePath.post,
              resource: 'posts',
              actor: user,
              target: {
                id: post.id,
                type: 'post',
                label: this.toPostLabel(post),
                url: `/posts/${post.id}`,
              },
              changes: this.activityLogsService.buildChanges(snapshot, this.toPostLogSnapshot(post)),
            });
            return this.toPostResponse(post);
          }),
      );
  }

  @Delete(':id')
  @UseGuards(AuthGuard, PermissionsGuard)
  @Permissions({ resource: Resource.Posts, actions: [Action.Delete] })
  async remove(@User() user: UserEntity, @Param('id', ParseIntPipe) id: number) {
    // Read the post before delete so the log still keeps its label and target id.
    const post = await this.postService.findOne(id);
    await this.postService.remove(id);
    await this.activityLogsService.log({
      kind: 'deleted',
      activity: 'Post deleted',
      module: ActivityLogModulePath.post,
      resource: 'posts',
      actor: user,
      target: {
        id: post.id,
        type: 'post',
        label: this.toPostLabel(post),
        url: `/posts/${post.id}`,
      },
    });
    return { message: 'Post deleted' };
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

  private toPostResponse(post: PostEntity) {
    const documents = post.documents ?? null;
    const documentEn = documents?.en ?? null;
    const documentKm = documents?.km ?? null;

    return {
      id: post.id,
      title: post.title,
      description: post.description ?? null,
      slug: post.slug,
      content: post.content,
      status: post.status,
      isPublished: post.status === 'published',
      publishedAt: post.publishedAt ?? null,
      isFeatured: post.isFeatured,
      expiredAt: post.expiredAt ?? null,
      coverImage: post.coverImage ?? null,
      documents: {
        en: documentEn,
        km: documentKm,
      },
      documentThumbnails: {
        en: documentEn?.thumbnailUrl ?? null,
        km: documentKm?.thumbnailUrl ?? null,
      },
      link: post.link ?? null,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
      author: post.author
        ? { id: post.author.id, displayName: post.author.username, email: post.author.email }
        : null,
      category: post.category ? { id: post.category.id, name: post.category.name } : null,
      page: post.page ? { id: post.page.id, title: post.page.title, slug: post.page.slug } : null,
      section: post.section
        ? { id: post.section.id, pageId: post.section.pageId, blockType: post.section.blockType, title: post.section.title }
        : null,
      sections:
        post.sections?.map((section) => ({
          id: section.id,
          pageId: section.pageId,
          blockType: section.blockType,
          title: section.title,
        })) ?? [],
    };
  }

  private toPostLabel(post: PostEntity): string {
    return post.title?.en?.trim() || post.title?.km?.trim() || post.slug || `Post ${post.id}`;
  }

  private toPostLogSnapshot(post: PostEntity): Record<string, unknown> {
    // Keep only fields that matter for activity history and diff display.
    return {
      title: post.title ?? null,
      description: post.description ?? null,
      slug: post.slug ?? null,
      content: post.content ?? null,
      status: post.status,
      publishedAt: post.publishedAt ?? null,
      expiredAt: post.expiredAt ?? null,
      isFeatured: post.isFeatured,
      coverImage: post.coverImage ?? null,
      documents: post.documents ?? null,
      link: post.link ?? null,
      categoryId: post.category?.id ?? null,
      pageId: post.page?.id ?? null,
      sectionId: post.section?.id ?? post.sectionId ?? null,
      sectionIds: post.sections?.map((section) => section.id) ?? [],
    };
  }
}
