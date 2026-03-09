import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, Req } from "@nestjs/common";
import { ContactService } from "./contact.service";
import { CreateContactDto } from "./dto/create-contact.dto";
import { ListContactDto } from "./dto/list-contact.dto";
import { UpdateContactDto } from "./dto/update-contact.dto";
import { ActivityLogsService } from '@/modules/activity-logs/activity-logs.service';
import { ActivityLogModulePath } from '@/modules/activity-logs/activity-log.constants';
import type { AuthRequest } from '@/types/expressRequest.interface';


@Controller("contact")
export class ContactController {
  constructor(
    private readonly service: ContactService,
    private readonly activityLogsService: ActivityLogsService,
  ) {}

  // POST /contact (public contact form submit)
  @Post()
  async create(@Body() dto: CreateContactDto, @Req() req: AuthRequest) {
    const contact = await this.service.create(dto);
    // Public contact submits are still logged even when there is no authenticated user.
    await this.activityLogsService.log({
      kind: 'submit',
      activity: 'Contact form submitted',
      module: ActivityLogModulePath.contact,
      resource: 'contact',
      actor: req.user?.id ? req.user : null,
      target: {
        id: contact.id,
        type: 'contact',
        label: contact.subject,
        url: `/contact/${contact.id}`,
      },
      metadata: {
        ...(this.activityLogsService.buildRequestMetadata(req) ?? {}),
        email: contact.email,
      },
    });
    return contact;
  }

  // GET /contact?q=&page=&limit=
  @Get()
  findAll(@Query() query: ListContactDto) {
    return this.service.findAll(query);
  }

  // GET /contact/:id
  @Get(":id")
  findOne(@Param("id", ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  // PATCH /contact/:id
  @Patch(":id")
  async update(@Param("id", ParseIntPipe) id: number, @Body() dto: UpdateContactDto, @Req() req: AuthRequest) {
    // Read the old contact first so the detail modal can show field changes.
    const before = this.activityLogsService.clone(await this.service.findOne(id));
    const item = await this.service.update(id, dto);
    await this.activityLogsService.log({
      kind: 'updated',
      activity: 'Contact record updated',
      module: ActivityLogModulePath.contact,
      resource: 'contact',
      actor: req.user?.id ? req.user : null,
      target: {
        id: item.id,
        type: 'contact',
        label: item.subject,
        url: `/contact/${item.id}`,
      },
      changes: this.activityLogsService.buildChanges(
        before as unknown as Record<string, unknown>,
        item as unknown as Record<string, unknown>,
      ),
      metadata: this.activityLogsService.buildRequestMetadata(req),
    });
    return item;
  }

  // PATCH /contact/:id/read  body: { isRead: true }
  @Patch(":id/read")
  async markRead(@Param("id", ParseIntPipe) id: number, @Body() body: { isRead?: boolean }, @Req() req: AuthRequest) {
    const item = await this.service.markRead(id, body?.isRead ?? true);
    // mark_read logs are simple state changes, so no large diff is needed here.
    await this.activityLogsService.log({
      kind: 'mark_read',
      activity: item.isRead ? 'Contact marked as read' : 'Contact marked as unread',
      module: ActivityLogModulePath.contact,
      resource: 'contact',
      actor: req.user?.id ? req.user : null,
      target: {
        id: item.id,
        type: 'contact',
        label: item.subject,
        url: `/contact/${item.id}`,
      },
      metadata: this.activityLogsService.buildRequestMetadata(req),
    });
    return item;
  }

  // DELETE /contact/:id
  @Delete(":id")
  async remove(@Param("id", ParseIntPipe) id: number, @Req() req: AuthRequest) {
    // Keep the subject before delete so the activity row stays readable.
    const item = await this.service.findOne(id);
    await this.service.remove(id);
    await this.activityLogsService.log({
      kind: 'deleted',
      activity: 'Contact deleted',
      module: ActivityLogModulePath.contact,
      resource: 'contact',
      actor: req.user?.id ? req.user : null,
      target: {
        id: item.id,
        type: 'contact',
        label: item.subject,
        url: `/contact/${item.id}`,
      },
      metadata: this.activityLogsService.buildRequestMetadata(req),
    });
    return { success: true };
  }
}
