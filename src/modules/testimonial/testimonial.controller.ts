import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put, Query, UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';
import { TestimonialService } from './testimonial.service';
import { CreateTestimonialDto } from './dto/create-testimonial.dto';
import { UpdateTestimonialDto } from './dto/update-testimonial.dto';
import { TestimonialStatus } from './testimonial.entity';
import { AuthGuard } from '@/modules/auth/guards/auth.guard';
import { PermissionsGuard } from '@/modules/roles/guards/permissions.guard';
import { Permissions } from '@/modules/roles/decorator/permissions.decorator';
import { Resource } from '@/modules/roles/enums/resource.enum';
import { Action } from '@/modules/roles/enums/actions.enum';
import { User } from '@/modules/auth/decorators/user.decorator';
import { UserEntity } from '@/modules/users/entities/user.entity';
import { ActivityLogsService } from '@/modules/activity-logs/activity-logs.service';
import { ActivityLogModulePath } from '@/modules/activity-logs/activity-log.constants';

@Controller('testimonials')
export class TestimonialController {
  constructor(
    private readonly testimonialService: TestimonialService,
    private readonly activityLogsService: ActivityLogsService,
  ) {}

  @Get()
  async findAll(@Query('status') status?: TestimonialStatus, @Query('lang') lang?: string) {
    const items = await this.testimonialService.findAll(status);
    const normalizedLang = this.normalizeLang(lang);
    return items.map((t) => ({
      id: t.id,
      title: this.pickLocalized(t.title, normalizedLang),
      quote: this.pickLocalized(t.quote, normalizedLang),
      authorName: t.authorName,
      authorRole: t.authorRole ?? null,
      company: t.company ?? null,
      rating: t.rating ?? null,
      avatarUrl: t.avatarUrl ?? null,
      status: t.status,
      orderIndex: t.orderIndex,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
    }));
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number, @Query('lang') lang?: string) {
    const t = await this.testimonialService.findOne(id);
    const normalizedLang = this.normalizeLang(lang);
    return {
      id: t.id,
      title: this.pickLocalized(t.title, normalizedLang),
      quote: this.pickLocalized(t.quote, normalizedLang),
      authorName: t.authorName,
      authorRole: t.authorRole ?? null,
      company: t.company ?? null,
      rating: t.rating ?? null,
      avatarUrl: t.avatarUrl ?? null,
      status: t.status,
      orderIndex: t.orderIndex,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
    };
  }

  @Post()
  @UseGuards(AuthGuard, PermissionsGuard)
  @Permissions({ resource: Resource.Testimonials, actions: [Action.Create] })
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
  create(@User() user: UserEntity, @Body() dto: CreateTestimonialDto) {
    return this.testimonialService.create(user, dto).then(async (testimonial) => {
      // Testimonial create is logged only after the DB row is saved.
      await this.activityLogsService.log({
        kind: 'created',
        activity: 'Testimonial created',
        module: ActivityLogModulePath.testimonial,
        resource: 'testimonials',
        actor: user,
        target: {
          id: testimonial.id,
          type: 'testimonial',
          label: this.toLabel(testimonial),
          url: `/testimonials/${testimonial.id}`,
        },
      });
      return testimonial;
    });
  }

  @Put(':id')
  @UseGuards(AuthGuard, PermissionsGuard)
  @Permissions({ resource: Resource.Testimonials, actions: [Action.Update] })
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
  async update(@User() user: UserEntity, @Param('id', ParseIntPipe) id: number, @Body() dto: UpdateTestimonialDto) {
    // Read the current testimonial first so update detail can show before/after.
    const before = await this.testimonialService.findOne(id);
    return this.testimonialService.update(id, dto).then(async (testimonial) => {
      await this.activityLogsService.log({
        kind: 'updated',
        activity: 'Testimonial updated',
        module: ActivityLogModulePath.testimonial,
        resource: 'testimonials',
        actor: user,
        target: {
          id: testimonial.id,
          type: 'testimonial',
          label: this.toLabel(testimonial),
          url: `/testimonials/${testimonial.id}`,
        },
        changes: this.activityLogsService.buildChanges(
          this.toLogSnapshot(before),
          this.toLogSnapshot(testimonial),
        ),
      });
      return testimonial;
    });
  }

  @Delete(':id')
  @UseGuards(AuthGuard, PermissionsGuard)
  @Permissions({ resource: Resource.Testimonials, actions: [Action.Delete] })
  async remove(@User() user: UserEntity, @Param('id', ParseIntPipe) id: number) {
    // Keep the author label before delete for a better activity row.
    const testimonial = await this.testimonialService.findOne(id);
    await this.testimonialService.remove(id);
    await this.activityLogsService.log({
      kind: 'deleted',
      activity: 'Testimonial deleted',
      module: ActivityLogModulePath.testimonial,
      resource: 'testimonials',
      actor: user,
      target: {
        id: testimonial.id,
        type: 'testimonial',
        label: this.toLabel(testimonial),
        url: `/testimonials/${testimonial.id}`,
      },
    });
    return { message: 'Testimonial deleted' };
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

  private toLabel(testimonial: { authorName?: { en?: string; km?: string } | null; id: number }): string {
    return testimonial.authorName?.en?.trim() || testimonial.authorName?.km?.trim() || `Testimonial ${testimonial.id}`;
  }

  private toLogSnapshot(testimonial: {
    quote?: unknown;
    title?: unknown;
    authorName?: unknown;
    authorRole?: unknown;
    company?: unknown;
    rating?: unknown;
    avatarUrl?: unknown;
    status?: unknown;
    orderIndex?: unknown;
  }): Record<string, unknown> {
    // Snapshot only the public testimonial fields, not internal timestamps.
    return {
      quote: testimonial.quote ?? null,
      title: testimonial.title ?? null,
      authorName: testimonial.authorName ?? null,
      authorRole: testimonial.authorRole ?? null,
      company: testimonial.company ?? null,
      rating: testimonial.rating ?? null,
      avatarUrl: testimonial.avatarUrl ?? null,
      status: testimonial.status ?? null,
      orderIndex: testimonial.orderIndex ?? null,
    };
  }
}
