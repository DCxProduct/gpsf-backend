import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';
import { LogoService } from '@/modules/logo/logo.service';
import { UpdateLogoDto } from '@/modules/logo/dto/update-logo.dto';
import { AuthGuard } from '@/modules/auth/guards/auth.guard';
import { PermissionsGuard } from '@/modules/roles/guards/permissions.guard';
import { Permissions } from '@/modules/roles/decorator/permissions.decorator';
import { Resource } from '@/modules/roles/enums/resource.enum';
import { Action } from '@/modules/roles/enums/actions.enum';
import { LogoResponseInterface } from '@/modules/logo/types/logoResponse.interface';
import { LogosResponseInterface } from '@/modules/logo/types/logosResponse.interface';
import { UploadLogoDto } from '@/modules/logo/dto/upload-logo.dto';
import { ActivityLogsService } from '@/modules/activity-logs/activity-logs.service';
import { ActivityLogModulePath } from '@/modules/activity-logs/activity-log.constants';
import { User } from '@/modules/auth/decorators/user.decorator';
import { UserEntity } from '@/modules/users/entities/user.entity';
import { LogoEntity } from '@/modules/logo/logo.entity';

@Controller('logo')
export class LogoController {
  constructor(
    private readonly logoService: LogoService,
    private readonly activityLogsService: ActivityLogsService,
  ) {}

  @Get()
  async getAll(): Promise<LogosResponseInterface> {
    const logos = await this.logoService.findAll();
    return { logos, logosCount: logos.length };
  }

  @Get(':id')
  async getById(@Param('id') id: string): Promise<LogoResponseInterface> {
    const logo = await this.logoService.findById(Number(id));
    return { logo };
  }

  @Post()
  @UseGuards(AuthGuard, PermissionsGuard)
  @Permissions({ resource: Resource.Logo, actions: [Action.Create] })
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
  async create(@User() user: UserEntity, @Body() dto: UploadLogoDto): Promise<LogoResponseInterface> {
    const logo = await this.logoService.create(dto);
    // Logo create uses the saved id so the activity table can open the exact record.
    await this.activityLogsService.log({
      kind: 'created',
      activity: 'Logo created',
      module: ActivityLogModulePath.logo,
      resource: 'logo',
      actor: user,
      target: {
        id: logo.id,
        type: 'logo',
        label: this.toLabel(logo),
        url: `/logo/${logo.id}`,
      },
    });
    return { logo };
  }

  @Put(':id')
  @UseGuards(AuthGuard, PermissionsGuard)
  @Permissions({ resource: Resource.Logo, actions: [Action.Update] })
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
  async update(
    @User() user: UserEntity,
    @Param('id') id: string,
    @Body() dto: UpdateLogoDto,
  ): Promise<LogoResponseInterface> {
    // Read old logo first so update detail can show before/after values.
    const before = await this.logoService.findById(Number(id));
    const logo = await this.logoService.updateById(Number(id), dto);
    await this.activityLogsService.log({
      kind: 'updated',
      activity: 'Logo updated',
      module: ActivityLogModulePath.logo,
      resource: 'logo',
      actor: user,
      target: {
        id: logo.id,
        type: 'logo',
        label: this.toLabel(logo),
        url: `/logo/${logo.id}`,
      },
      changes: this.activityLogsService.buildChanges(
        this.toLogSnapshot(before),
        this.toLogSnapshot(logo),
      ),
    });
    return { logo };
  }

  @Delete(':id')
  @UseGuards(AuthGuard, PermissionsGuard)
  @Permissions({ resource: Resource.Logo, actions: [Action.Delete] })
  async remove(@User() user: UserEntity, @Param('id') id: string) {
    // Keep the logo label before delete for the activity row.
    const logo = await this.logoService.findById(Number(id));
    await this.logoService.removeById(Number(id));
    await this.activityLogsService.log({
      kind: 'deleted',
      activity: 'Logo deleted',
      module: ActivityLogModulePath.logo,
      resource: 'logo',
      actor: user,
      target: {
        id: logo.id,
        type: 'logo',
        label: this.toLabel(logo),
        url: `/logo/${logo.id}`,
      },
    });
    return { success: true };
  }

  private toLabel(logo: LogoEntity): string {
    return logo.title?.trim() || logo.url || `Logo ${logo.id}`;
  }

  private toLogSnapshot(logo: LogoEntity): Record<string, unknown> {
    return {
      url: logo.url,
      title: logo.title ?? null,
      description: logo.description ?? null,
      link: logo.link ?? null,
    };
  }
}
