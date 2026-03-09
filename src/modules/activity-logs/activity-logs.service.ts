import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { ActivityLogChanges, ActivityLogEntity, ActivityLogMetadata } from './activity-log.entity';
import { ListActivityLogsDto } from './dto/list-activity-logs.dto';

export type ActivityLogActor = {
  id?: number | null;
  username?: string | null;
  email?: string | null;
  image?: string | null;
};

export type ActivityLogInput = {
  kind: string;
  activity: string;
  module: string;
  resource: string;
  actor?: ActivityLogActor | null;
  target?: {
    id?: number | null;
    type?: string | null;
    label?: string | null;
    url?: string | null;
  } | null;
  changes?: ActivityLogChanges | null;
  metadata?: ActivityLogMetadata | null;
};

@Injectable()
export class ActivityLogsService {
  private readonly logger = new Logger(ActivityLogsService.name);
  // Skip noisy or sensitive fields when building update diffs.
  private readonly defaultIgnoredKeys = new Set<string>([
    'createdAt',
    'updatedAt',
    'password',
    'resetPasswordToken',
    'resetPasswordTokenExpiresAt',
    'token',
    'refreshToken',
    'buffer',
  ]);

  constructor(
    @InjectRepository(ActivityLogEntity)
    private readonly activityLogRepository: Repository<ActivityLogEntity>,
  ) {}

  async log(input: ActivityLogInput): Promise<ActivityLogEntity | null> {
    try {
      const actor = input.actor ?? null;
      const log = this.activityLogRepository.create({
        kind: input.kind,
        activity: input.activity,
        module: input.module,
        resource: input.resource,
        targetId: input.target?.id ?? null,
        targetType: input.target?.type ?? null,
        targetLabel: input.target?.label ?? null,
        targetUrl: input.target?.url ?? null,
        actorId: actor?.id ?? null,
        actorName: actor?.username ?? null,
        actorEmail: actor?.email ?? null,
        actorImage: actor?.image ?? null,
        changes: input.changes && Object.keys(input.changes).length ? input.changes : null,
        metadata: input.metadata && Object.keys(input.metadata).length ? input.metadata : null,
      });

      return await this.activityLogRepository.save(log);
    } catch (error) {
      // Activity logs must never block the main business action.
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(`Failed to write activity log: ${message}`);
      return null;
    }
  }

  async findAll(query: ListActivityLogsDto): Promise<{ items: ActivityLogEntity[]; total: number; page: number; limit: number }> {
    const page = Math.max(Number(query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(query.limit) || 20, 1), 100);
    const order = String(query.order ?? 'DESC').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    const skip = (page - 1) * limit;

    const qb = this.activityLogRepository
      .createQueryBuilder('log')
      .orderBy('log.createdAt', order)
      .skip(skip)
      .take(limit);

    if (query.kind) {
      qb.andWhere('LOWER(log.kind) = :kind', { kind: query.kind.toLowerCase() });
    }

    if (query.module) {
      qb.andWhere('LOWER(log.module) = :module', { module: query.module.toLowerCase() });
    }

    if (typeof query.actorId === 'number') {
      qb.andWhere('log.actorId = :actorId', { actorId: query.actorId });
    }

    if (query.q) {
      const q = `%${query.q.trim().toLowerCase()}%`;
      qb.andWhere(
        new Brackets((subQuery) => {
          subQuery
            .where('LOWER(log.activity) LIKE :q', { q })
            .orWhere("LOWER(COALESCE(log.targetLabel, '')) LIKE :q", { q })
            .orWhere("LOWER(COALESCE(log.actorName, '')) LIKE :q", { q })
            .orWhere("LOWER(COALESCE(log.actorEmail, '')) LIKE :q", { q });
        }),
      );
    }

    const fromDate = this.parseOptionalDate(query.from);
    if (fromDate) {
      qb.andWhere('log.createdAt >= :fromDate', { fromDate });
    }

    const toDate = this.parseOptionalDate(query.to, true);
    if (toDate) {
      qb.andWhere('log.createdAt <= :toDate', { toDate });
    }

    const [items, total] = await qb.getManyAndCount();
    return { items, total, page, limit };
  }

  async findOne(id: number): Promise<ActivityLogEntity> {
    const log = await this.activityLogRepository.findOne({ where: { id } });
    if (!log) {
      throw new NotFoundException('Activity log not found');
    }
    return log;
  }

  async remove(id: number): Promise<void> {
    const log = await this.findOne(id);
    await this.activityLogRepository.remove(log);
  }

  clone<T>(value: T): T {
    // JSON clone is enough here because log snapshots only store plain API data.
    return JSON.parse(JSON.stringify(value)) as T;
  }

  buildChanges(
    before: Record<string, unknown> | null | undefined,
    after: Record<string, unknown> | null | undefined,
    ignoredKeys: string[] = [],
  ): ActivityLogChanges | null {
    if (!before || !after) {
      return null;
    }

    const ignoreSet = new Set<string>([...this.defaultIgnoredKeys, ...ignoredKeys]);
    const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
    const changes: ActivityLogChanges = {};

    for (const key of keys) {
      if (ignoreSet.has(key)) {
        continue;
      }

      const beforeValue = (before as Record<string, unknown>)[key];
      const afterValue = (after as Record<string, unknown>)[key];
      // Only keep real changes so the detail view stays easy to read.
      if (this.areEqual(beforeValue, afterValue)) {
        continue;
      }

      changes[key] = {
        before: beforeValue ?? null,
        after: afterValue ?? null,
      };
    }

    return Object.keys(changes).length ? changes : null;
  }

  buildRequestMetadata(request?: {
    ip?: string;
    headers?: Record<string, unknown>;
    get?: (name: string) => string | undefined;
  } | null): ActivityLogMetadata | null {
    if (!request) {
      return null;
    }

    // Keep request metadata small and safe for UI/debugging.
    const userAgent =
      typeof request.get === 'function'
        ? request.get('user-agent') ?? null
        : this.normalizeHeaderValue(request.headers?.['user-agent']);

    const metadata: ActivityLogMetadata = {
      ipAddress: request.ip ?? null,
      userAgent,
    };

    return Object.values(metadata).some((value) => value)
      ? metadata
      : null;
  }

  private areEqual(left: unknown, right: unknown): boolean {
    return JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
  }

  private normalizeHeaderValue(value: unknown): string | null {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
    if (Array.isArray(value)) {
      return value.find((item) => typeof item === 'string' && item.trim().length > 0)?.trim() ?? null;
    }
    return null;
  }

  private parseOptionalDate(value?: string, endOfDay = false): Date | null {
    if (!value) {
      return null;
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return null;
    }

    if (endOfDay && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      parsed.setHours(23, 59, 59, 999);
    }

    return parsed;
  }
}
