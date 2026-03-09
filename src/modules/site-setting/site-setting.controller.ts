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
  UploadedFiles,
  UseGuards,
  UseInterceptors,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { SiteSettingService } from '@/modules/site-setting/site-setting.service';
import { CreateSiteSettingDto } from '@/modules/site-setting/dto/create-site-setting.dto';
import { UpdateSiteSettingDto } from '@/modules/site-setting/dto/update-site-setting.dto';
import { AuthGuard } from '@/modules/auth/guards/auth.guard';
import { PermissionsGuard } from '@/modules/roles/guards/permissions.guard';
import { Permissions } from '@/modules/roles/decorator/permissions.decorator';
import { Resource } from '@/modules/roles/enums/resource.enum';
import { Action } from '@/modules/roles/enums/actions.enum';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { UploadedFilePayload } from '@/types/uploaded-file.type';
import { SiteSettingEntity } from '@/modules/site-setting/site-setting.entity';
import { ActivityLogsService } from '@/modules/activity-logs/activity-logs.service';
import { ActivityLogModulePath } from '@/modules/activity-logs/activity-log.constants';
import { User } from '@/modules/auth/decorators/user.decorator';
import { UserEntity } from '@/modules/users/entities/user.entity';

const SITE_LOGO_FIELDS: Array<{ name: string; maxCount: number }> = [
  { name: 'logo', maxCount: 1 },
  { name: 'siteLogo', maxCount: 1 },
  { name: 'SiteLogo', maxCount: 1 },
];

const ALLOWED_LOGO_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/svg+xml',
  'image/gif',
]);

const SITE_LOGO_UPLOAD_OPTIONS = {
  storage: memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req: unknown, file: Express.Multer.File, cb: (error: Error | null, acceptFile: boolean) => void) => {
    if (ALLOWED_LOGO_MIME_TYPES.has(file.mimetype)) {
      cb(null, true);
      return;
    }
    cb(new BadRequestException(`Unsupported logo file type: ${file.mimetype}`), false);
  },
};

@Controller('site-settings')
export class SiteSettingController {
  constructor(
    private readonly siteSettingService: SiteSettingService,
    private readonly activityLogsService: ActivityLogsService,
  ) {}

  @Get()
  findAll() {
    return this.siteSettingService
      .findAll()
      .then((items) => items.map((item) => this.toSiteSettingResponse(item)));
  }

  @Get('current')
  findCurrent() {
    return this.siteSettingService
      .findCurrent()
      .then((item) => (item ? this.toSiteSettingResponse(item) : null));
  }

  @Get('current/contact-panel')
  findCurrentContactPanel() {
    return this.siteSettingService.findCurrentContactPanel();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.siteSettingService
      .findOne(id)
      .then((item) => this.toSiteSettingResponse(item));
  }

  @Post()
  @UseGuards(AuthGuard, PermissionsGuard)
  @Permissions({ resource: Resource.SiteSettings, actions: [Action.Create] })
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
  @UseInterceptors(
    FileFieldsInterceptor(
      SITE_LOGO_FIELDS,
      SITE_LOGO_UPLOAD_OPTIONS,
    ),
  )
  create(
    @User() user: UserEntity,
    @Body() dto: CreateSiteSettingDto,
    @UploadedFiles()
    files: Partial<Record<'logo' | 'siteLogo' | 'SiteLogo', UploadedFilePayload[]>>,
  ) {
    const file = this.pickFile(files);
    return this.siteSettingService
      .create(dto, file)
      .then(async (item) => {
        // Site settings writes often replace large JSON fields, so log a simple create row here.
        await this.activityLogsService.log({
          kind: 'created',
          activity: 'Site settings created',
          module: ActivityLogModulePath.siteSetting,
          resource: 'site-settings',
          actor: user,
          target: {
            id: item.id,
            type: 'site-setting',
            label: this.toLabel(item),
            url: `/site-settings/${item.id}`,
          },
        });
        return this.toSiteSettingResponse(item);
      });
  }

  @Put('current')
  @UseGuards(AuthGuard, PermissionsGuard)
  @Permissions({ resource: Resource.SiteSettings, actions: [Action.Update] })
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
  @UseInterceptors(
    FileFieldsInterceptor(
      SITE_LOGO_FIELDS,
      SITE_LOGO_UPLOAD_OPTIONS,
    ),
  )
  updateCurrent(
    @User() user: UserEntity,
    @Body() dto: UpdateSiteSettingDto,
    @UploadedFiles()
    files: Partial<Record<'logo' | 'siteLogo' | 'SiteLogo', UploadedFilePayload[]>>,
  ) {
    const file = this.pickFile(files);
    // Upsert can either create or update, so check the current row first.
    return this.siteSettingService.findCurrent().then((before) =>
      this.siteSettingService
        .upsertCurrent(dto, file)
        .then(async (item) => {
          await this.activityLogsService.log({
            kind: before ? 'updated' : 'created',
            activity: before ? 'Site settings updated' : 'Site settings created',
            module: ActivityLogModulePath.siteSetting,
            resource: 'site-settings',
            actor: user,
            target: {
              id: item.id,
              type: 'site-setting',
              label: this.toLabel(item),
              url: `/site-settings/${item.id}`,
            },
            changes: before
              ? this.activityLogsService.buildChanges(
                  this.toSiteSettingResponse(before) as Record<string, unknown>,
                  this.toSiteSettingResponse(item) as Record<string, unknown>,
                )
              : null,
          });
          return this.toSiteSettingResponse(item);
        }),
    );
  }

  @Put(':id')
  @UseGuards(AuthGuard, PermissionsGuard)
  @Permissions({ resource: Resource.SiteSettings, actions: [Action.Update] })
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
  @UseInterceptors(
    FileFieldsInterceptor(
      SITE_LOGO_FIELDS,
      SITE_LOGO_UPLOAD_OPTIONS,
    ),
  )
  update(
    @User() user: UserEntity,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateSiteSettingDto,
    @UploadedFiles()
    files: Partial<Record<'logo' | 'siteLogo' | 'SiteLogo', UploadedFilePayload[]>>,
  ) {
    const file = this.pickFile(files);
    // Load the old settings first so the detail view can show what changed.
    return this.siteSettingService.findOne(id).then((before) =>
      this.siteSettingService
        .update(id, dto, file)
        .then(async (item) => {
          await this.activityLogsService.log({
            kind: 'updated',
            activity: 'Site settings updated',
            module: ActivityLogModulePath.siteSetting,
            resource: 'site-settings',
            actor: user,
            target: {
              id: item.id,
              type: 'site-setting',
              label: this.toLabel(item),
              url: `/site-settings/${item.id}`,
            },
            changes: this.activityLogsService.buildChanges(
              this.toSiteSettingResponse(before) as Record<string, unknown>,
              this.toSiteSettingResponse(item) as Record<string, unknown>,
            ),
          });
          return this.toSiteSettingResponse(item);
        }),
    );
  }

  @Delete(':id')
  @UseGuards(AuthGuard, PermissionsGuard)
  @Permissions({ resource: Resource.SiteSettings, actions: [Action.Delete] })
  async remove(@User() user: UserEntity, @Param('id', ParseIntPipe) id: number) {
    // Read before delete so the log still shows which settings record was removed.
    const item = await this.siteSettingService.findOne(id);
    await this.siteSettingService.remove(id);
    await this.activityLogsService.log({
      kind: 'deleted',
      activity: 'Site settings deleted',
      module: ActivityLogModulePath.siteSetting,
      resource: 'site-settings',
      actor: user,
      target: {
        id: item.id,
        type: 'site-setting',
        label: this.toLabel(item),
        url: `/site-settings/${item.id}`,
      },
    });
    return { message: 'Site setting deleted' };
  }

  private pickFile(
    files?: Partial<Record<'logo' | 'siteLogo' | 'SiteLogo', UploadedFilePayload[]>>,
  ): UploadedFilePayload | null {
    const raw =
      files?.logo?.[0] ??
      files?.siteLogo?.[0] ??
      files?.SiteLogo?.[0] ??
      null;
    if (!raw || !raw.buffer) return null;
    return { originalname: raw.originalname, buffer: raw.buffer, mimetype: raw.mimetype };
  }

  private toSiteSettingResponse(siteSetting: SiteSettingEntity) {
    return {
      id: siteSetting.id,
      title: siteSetting.title ?? null,
      description: siteSetting.description ?? null,
      logo: siteSetting.logo ?? null,
      footerBackground: siteSetting.footerBackground ?? null,
      address: siteSetting.address ?? null,
      contact: siteSetting.contact ?? null,
      openTime: siteSetting.openTime ?? null,
      socialLinks: siteSetting.socialLinks ?? [],
      createdAt: siteSetting.createdAt,
      updatedAt: siteSetting.updatedAt,
    };
  }

  private toLabel(siteSetting: SiteSettingEntity): string {
    return siteSetting.title?.en?.trim() || siteSetting.title?.km?.trim() || `Site Setting ${siteSetting.id}`;
  }
}
