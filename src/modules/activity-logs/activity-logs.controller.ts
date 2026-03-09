import { Controller, Delete, Get, Param, ParseIntPipe, Query, UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';
import { ActivityLogsService } from './activity-logs.service';
import { AuthGuard } from '@/modules/auth/guards/auth.guard';
import { PermissionsGuard } from '@/modules/roles/guards/permissions.guard';
import { Permissions } from '@/modules/roles/decorator/permissions.decorator';
import { Resource } from '@/modules/roles/enums/resource.enum';
import { Action } from '@/modules/roles/enums/actions.enum';
import { ListActivityLogsDto } from './dto/list-activity-logs.dto';
import { ActivityLogEntity } from './activity-log.entity';
import { ActivityLogResponseInterface } from './types/activity-log-response-interface';
import { ActivityLogsResponseInterface } from './types/activity-logs-response-interface';

@Controller('activity-logs')
export class ActivityLogsController {
  constructor(private readonly activityLogsService: ActivityLogsService) {}

  @Get()
  @UseGuards(AuthGuard, PermissionsGuard)
  @Permissions({ resource: Resource.ActivityLogs, actions: [Action.Read] })
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
  async findAll(@Query() query: ListActivityLogsDto): Promise<ActivityLogsResponseInterface> {
    // List response is shaped for the table view.
    const { items, total, page, limit } = await this.activityLogsService.findAll(query);
    return {
      items: items.map((item) => this.toListItem(item)),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  @Get(':id')
  @UseGuards(AuthGuard, PermissionsGuard)
  @Permissions({ resource: Resource.ActivityLogs, actions: [Action.Read] })
  async findOne(@Param('id', ParseIntPipe) id: number): Promise<ActivityLogResponseInterface> {
    // Detail response includes the change diff and extra metadata.
    const item = await this.activityLogsService.findOne(id);
    return this.toDetail(item);
  }

  @Delete(':id')
  @UseGuards(AuthGuard, PermissionsGuard)
  @Permissions({ resource: Resource.ActivityLogs, actions: [Action.Delete] })
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.activityLogsService.remove(id);
    return { message: 'Activity log deleted' };
  }

  private toListItem(item: ActivityLogEntity) {
    return {
      id: item.id,
      kind: item.kind,
      activity: item.activity,
      module: item.module,
      user: {
        id: item.actorId ?? null,
        name: item.actorName ?? null,
        email: item.actorEmail ?? null,
        image: item.actorImage ?? null,
      },
      target: {
        id: item.targetId ?? null,
        type: item.targetType ?? null,
        label: item.targetLabel ?? null,
        url: item.targetUrl ?? null,
      },
      date: item.createdAt,
    };
  }

  private toDetail(item: ActivityLogEntity): ActivityLogResponseInterface {
    return {
      id: item.id,
      kind: item.kind,
      activity: item.activity,
      module: item.module,
      resource: item.resource,
      user: {
        id: item.actorId ?? null,
        name: item.actorName ?? null,
        email: item.actorEmail ?? null,
        image: item.actorImage ?? null,
      },
      target: {
        id: item.targetId ?? null,
        type: item.targetType ?? null,
        label: item.targetLabel ?? null,
        url: item.targetUrl ?? null,
      },
      changes: item.changes ?? null,
      metadata: item.metadata ?? null,
      date: item.createdAt,
    };
  }
}
