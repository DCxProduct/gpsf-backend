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
} from '@nestjs/common';
import { WorkingGroupService } from './working-group.service';
import { WorkingGroupEntity, WorkingGroupStatus } from './working-group.entity';
import { CreateWorkingGroupDto } from './dto/create-working-group.dto';
import { UpdateWorkingGroupDto } from './dto/update-working-group.dto';
import { AuthGuard } from '@/modules/auth/guards/auth.guard';
import { PermissionsGuard } from '@/modules/roles/guards/permissions.guard';
import { Permissions } from '@/modules/roles/decorator/permissions.decorator';
import { Resource } from '@/modules/roles/enums/resource.enum';
import { Action } from '@/modules/roles/enums/actions.enum';
import { User } from '@/modules/auth/decorators/user.decorator';
import { UserEntity } from '@/modules/users/entities/user.entity';
import { ActivityLogsService } from '@/modules/activity-logs/activity-logs.service';
import { ActivityLogModulePath } from '@/modules/activity-logs/activity-log.constants';

@Controller('working-groups')
export class WorkingGroupController {
  constructor(
    private readonly workingGroupService: WorkingGroupService,
    private readonly activityLogsService: ActivityLogsService,
  ) {}

  @Get()
  async findAll(
    @Query('status') status?: WorkingGroupStatus,
    @Query('pageId') pageId?: string,
    @Query('lang') lang?: string,
  ) {
    const normalizedLang = this.normalizeLang(lang);
    const normalizedPageId = this.parsePageId(pageId);
    const { items, total } = await this.workingGroupService.findAll(status, normalizedPageId);
    return {
      total,
      items: items.map((item) => this.toResponse(item, normalizedLang)),
    };
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number, @Query('lang') lang?: string) {
    const normalizedLang = this.normalizeLang(lang);
    const item = await this.workingGroupService.findOne(id);
    return this.toResponse(item, normalizedLang);
  }

  @Post()
  @UseGuards(AuthGuard, PermissionsGuard)
  @Permissions({ resource: Resource.WorkingGroups, actions: [Action.Create] })
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
  async create(@User() user: UserEntity, @Body() dto: CreateWorkingGroupDto) {
    const item = await this.workingGroupService.create(user, dto);
    // Log after save so the entry already has its final id and page link.
    await this.activityLogsService.log({
      kind: 'created',
      activity: 'Working group created',
      module: ActivityLogModulePath.workingGroup,
      resource: 'working-groups',
      actor: user,
      target: {
        id: item.id,
        type: 'working-group',
        label: this.toLabel(item),
        url: `/working-groups/${item.id}`,
      },
    });
    return this.toResponse(item);
  }

  @Put(':id')
  @UseGuards(AuthGuard, PermissionsGuard)
  @Permissions({ resource: Resource.WorkingGroups, actions: [Action.Update] })
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
  async update(@User() user: UserEntity, @Param('id', ParseIntPipe) id: number, @Body() dto: UpdateWorkingGroupDto) {
    // Capture old values first for the activity detail modal.
    const before = await this.workingGroupService.findOne(id);
    const item = await this.workingGroupService.update(id, dto);
    await this.activityLogsService.log({
      kind: 'updated',
      activity: 'Working group updated',
      module: ActivityLogModulePath.workingGroup,
      resource: 'working-groups',
      actor: user,
      target: {
        id: item.id,
        type: 'working-group',
        label: this.toLabel(item),
        url: `/working-groups/${item.id}`,
      },
      changes: this.activityLogsService.buildChanges(this.toLogSnapshot(before), this.toLogSnapshot(item)),
    });
    return this.toResponse(item);
  }

  @Delete(':id')
  @UseGuards(AuthGuard, PermissionsGuard)
  @Permissions({ resource: Resource.WorkingGroups, actions: [Action.Delete] })
  async remove(@User() user: UserEntity, @Param('id', ParseIntPipe) id: number) {
    // Read label before delete so the log row stays human-readable.
    const item = await this.workingGroupService.findOne(id);
    await this.workingGroupService.remove(id);
    await this.activityLogsService.log({
      kind: 'deleted',
      activity: 'Working group deleted',
      module: ActivityLogModulePath.workingGroup,
      resource: 'working-groups',
      actor: user,
      target: {
        id: item.id,
        type: 'working-group',
        label: this.toLabel(item),
        url: `/working-groups/${item.id}`,
      },
    });
    return { message: 'Working group deleted' };
  }

  private parsePageId(pageId?: string): number | undefined {
    if (pageId === undefined || pageId === null || pageId === '') {
      return undefined;
    }

    const parsed = Number(pageId);
    if (!Number.isInteger(parsed) || parsed < 1) {
      throw new BadRequestException('pageId must be a positive integer');
    }

    return parsed;
  }

  private normalizeLang(lang?: string): 'en' | 'km' | undefined {
    const normalized = String(lang ?? '').toLowerCase();
    if (normalized === 'en' || normalized === 'km') {
      return normalized;
    }
    return undefined;
  }

  private pickLocalized<T extends { en?: string; km?: string } | null | undefined>(
    value: T,
    lang?: 'en' | 'km',
  ) {
    if (!lang) {
      return value ?? null;
    }
    if (!value) {
      return null;
    }
    return value[lang] ?? value.en ?? value.km ?? null;
  }

  private toResponse(item: WorkingGroupEntity, lang?: 'en' | 'km') {
    return {
      id: item.id,
      title: this.pickLocalized(item.title, lang),
      description: this.pickLocalized(item.description, lang),
      iconUrl: item.iconUrl ?? null,
      status: item.status,
      orderIndex: item.orderIndex,
      pageId: item.pageId ?? null,
      page: item.page
        ? {
            id: item.page.id,
            title: this.pickLocalized(item.page.title, lang),
            slug: item.page.slug,
          }
        : null,
      createdBy: item.createdBy
        ? {
            id: item.createdBy.id,
            displayName: item.createdBy.username,
            email: item.createdBy.email,
          }
        : null,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };
  }

  private toLabel(item: WorkingGroupEntity): string {
    return item.title?.en?.trim() || item.title?.km?.trim() || `Working group ${item.id}`;
  }

  private toLogSnapshot(item: WorkingGroupEntity): Record<string, unknown> {
    // Keep the diff focused on editable working-group fields.
    return {
      title: item.title ?? null,
      description: item.description ?? null,
      iconUrl: item.iconUrl ?? null,
      status: item.status,
      orderIndex: item.orderIndex,
      pageId: item.pageId ?? null,
    };
  }
}
