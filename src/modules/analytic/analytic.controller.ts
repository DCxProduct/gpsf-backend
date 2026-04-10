import { BadRequestException, Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@/modules/auth/guards/auth.guard';
import { AnalyticService } from '@/modules/analytic/analytic.service';

@Controller('analytics')
@UseGuards(AuthGuard)
export class AnalyticController {
  constructor(private readonly analyticService: AnalyticService) {}

  @Get('overview')
  async getOverview(@Query('days') days?: string) {
    const normalizedDays = this.parsePositiveInt(days, 'days') ?? 30;
    return this.analyticService.getOverview(normalizedDays);
  }

  @Get('top-pages')
  async getTopPages(
    @Query('days') days?: string,
    @Query('limit') limit?: string,
  ) {
    const normalizedDays = this.parsePositiveInt(days, 'days') ?? 30;
    const normalizedLimit = this.parsePositiveInt(limit, 'limit') ?? 10;
    return this.analyticService.getTopPages(normalizedDays, normalizedLimit);
  }

  @Get('countries')
  async getCountries(
    @Query('days') days?: string,
    @Query('limit') limit?: string,
  ) {
    const normalizedDays = this.parsePositiveInt(days, 'days') ?? 30;
    const normalizedLimit = this.parsePositiveInt(limit, 'limit') ?? 10;
    return this.analyticService.getCountries(normalizedDays, normalizedLimit);
  }

  @Get('devices')
  async getDevices(
    @Query('days') days?: string,
    @Query('limit') limit?: string,
  ) {
    const normalizedDays = this.parsePositiveInt(days, 'days') ?? 30;
    const normalizedLimit = this.parsePositiveInt(limit, 'limit') ?? 10;
    return this.analyticService.getDevices(normalizedDays, normalizedLimit);
  }

  @Get('browsers')
  async getBrowsers(
    @Query('days') days?: string,
    @Query('limit') limit?: string,
  ) {
    const normalizedDays = this.parsePositiveInt(days, 'days') ?? 30;
    const normalizedLimit = this.parsePositiveInt(limit, 'limit') ?? 10;
    return this.analyticService.getBrowsers(normalizedDays, normalizedLimit);
  }

  @Get('operating-systems')
  async getOperatingSystems(
    @Query('days') days?: string,
    @Query('limit') limit?: string,
  ) {
    const normalizedDays = this.parsePositiveInt(days, 'days') ?? 30;
    const normalizedLimit = this.parsePositiveInt(limit, 'limit') ?? 10;
    return this.analyticService.getOperatingSystems(normalizedDays, normalizedLimit);
  }

  @Get('screen-resolutions')
  async getScreenResolutions(
    @Query('days') days?: string,
    @Query('limit') limit?: string,
  ) {
    const normalizedDays = this.parsePositiveInt(days, 'days') ?? 30;
    const normalizedLimit = this.parsePositiveInt(limit, 'limit') ?? 10;
    return this.analyticService.getScreenResolutions(normalizedDays, normalizedLimit);
  }

  @Get('traffic-sources')
  async getTrafficSources(
    @Query('days') days?: string,
    @Query('limit') limit?: string,
  ) {
    const normalizedDays = this.parsePositiveInt(days, 'days') ?? 30;
    const normalizedLimit = this.parsePositiveInt(limit, 'limit') ?? 10;
    return this.analyticService.getTrafficSources(normalizedDays, normalizedLimit);
  }

  @Get('tech-overview')
  async getTechOverview(
    @Query('days') days?: string,
    @Query('limit') limit?: string,
  ) {
    const normalizedDays = this.parsePositiveInt(days, 'days') ?? 30;
    const normalizedLimit = this.parsePositiveInt(limit, 'limit') ?? 10;
    return this.analyticService.getTechOverview(normalizedDays, normalizedLimit);
  }

  private parsePositiveInt(value: string | undefined, fieldName: string): number | undefined {
    if (value === undefined || value === '') {
      return undefined;
    }

    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 1) {
      throw new BadRequestException(`${fieldName} must be a positive integer`);
    }

    return parsed;
  }
}
