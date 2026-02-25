import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  LocalizedTextValue,
  SiteContactDeskValue,
  SiteContactLanguageValue,
  SiteContactValue,
  SiteSettingEntity,
  SiteSocialLinkValue,
} from '@/modules/site-setting/site-setting.entity';
import { CreateSiteSettingDto } from '@/modules/site-setting/dto/create-site-setting.dto';
import { UpdateSiteSettingDto } from '@/modules/site-setting/dto/update-site-setting.dto';
import { UploadedFilePayload } from '@/types/uploaded-file.type';
import * as fs from 'fs';
import * as path from 'path';

type ContactPanelDesk = {
  key: string;
  label: string;
  emails: string[];
};

type ContactSocialLink = {
  icon: string;
  title: string;
  url: string;
};

export type ContactPanelResponse = {
  address: {
    title: string;
    value: string | null;
  };
  contact: {
    title: string;
    phones: string[];
    desks: ContactPanelDesk[];
  };
  openTime: {
    title: string;
    days: string | null;
    hours: string | null;
    raw: string | null;
  };
  stayConnected: {
    title: string;
    links: ContactSocialLink[];
  };
  // Kept for backward API compatibility. New entity does not store map url.
  mapEmbedUrl: string | null;
  updatedAt: Date;
};

@Injectable()
export class SiteSettingService {
  constructor(
    @InjectRepository(SiteSettingEntity)
    private readonly siteSettingRepository: Repository<SiteSettingEntity>,
  ) {}

  async create(dto: CreateSiteSettingDto, file?: UploadedFilePayload | null): Promise<SiteSettingEntity> {
    const siteSetting = this.siteSettingRepository.create();
    this.applyDto(siteSetting, dto, true);

    let uploadedLogo: string | null = null;
    if (file?.buffer) {
      uploadedLogo = await this.uploadLogo(file);
      siteSetting.logo = uploadedLogo;
    } else if (dto.logo !== undefined) {
      siteSetting.logo = this.normalizeText(dto.logo);
    }

    try {
      return await this.siteSettingRepository.save(siteSetting);
    } catch (error) {
      if (uploadedLogo) {
        this.removeLocalFile(uploadedLogo);
      }
      throw error;
    }
  }

  async findAll(): Promise<SiteSettingEntity[]> {
    return await this.siteSettingRepository.find({ order: { createdAt: 'DESC' } });
  }

  async findCurrent(): Promise<SiteSettingEntity | null> {
    const [siteSetting] = await this.siteSettingRepository.find({
      order: { createdAt: 'DESC' },
      take: 1,
    });
    return siteSetting ?? null;
  }

  async findCurrentContactPanel(): Promise<ContactPanelResponse | null> {
    const current = await this.findCurrent();
    if (!current) {
      return null;
    }
    return this.toContactPanel(current);
  }

  async findOne(id: number): Promise<SiteSettingEntity> {
    const siteSetting = await this.siteSettingRepository.findOne({ where: { id } });
    if (!siteSetting) {
      throw new NotFoundException('Site setting not found');
    }
    return siteSetting;
  }

  async update(
    id: number,
    dto: UpdateSiteSettingDto,
    file?: UploadedFilePayload | null,
  ): Promise<SiteSettingEntity> {
    const siteSetting = await this.findOne(id);
    const previousLogo = siteSetting.logo ?? null;
    this.applyDto(siteSetting, dto, false);

    let uploadedLogo: string | null = null;
    if (file?.buffer) {
      uploadedLogo = await this.uploadLogo(file);
      siteSetting.logo = uploadedLogo;
    } else if (dto.logo !== undefined) {
      siteSetting.logo = this.normalizeText(dto.logo);
    }

    try {
      const saved = await this.siteSettingRepository.save(siteSetting);
      const nextLogo = saved.logo ?? null;
      if (previousLogo && previousLogo !== nextLogo) {
        this.removeLocalFile(previousLogo);
      }
      return saved;
    } catch (error) {
      if (uploadedLogo) {
        this.removeLocalFile(uploadedLogo);
      }
      throw error;
    }
  }

  async upsertCurrent(dto: UpdateSiteSettingDto, file?: UploadedFilePayload | null): Promise<SiteSettingEntity> {
    const current = await this.findCurrent();
    if (!current) {
      return this.create(dto as CreateSiteSettingDto, file);
    }
    return this.update(current.id, dto, file);
  }

  async remove(id: number): Promise<void> {
    const siteSetting = await this.findOne(id);
    const oldLogo = siteSetting.logo ?? null;
    await this.siteSettingRepository.remove(siteSetting);
    if (oldLogo) {
      this.removeLocalFile(oldLogo);
    }
  }

  private applyDto(
    siteSetting: SiteSettingEntity,
    dto: UpdateSiteSettingDto | CreateSiteSettingDto,
    isCreate: boolean,
  ): void {
    if (dto.title !== undefined) {
      siteSetting.title = this.normalizeLocalizedText(dto.title, 'title', true);
    } else if (isCreate) {
      throw new BadRequestException('title.en or title.km is required');
    }

    if (dto.description !== undefined) {
      siteSetting.description = this.normalizeLocalizedText(dto.description, 'description');
    }

    if (dto.footerBackground !== undefined) {
      siteSetting.footerBackground = this.normalizeText(dto.footerBackground);
    }

    if (dto.address !== undefined) {
      siteSetting.address = this.normalizeLocalizedText(dto.address, 'address');
    }

    if (dto.openTime !== undefined) {
      siteSetting.openTime = this.normalizeLocalizedText(dto.openTime, 'openTime');
    }

    if (dto.contact !== undefined) {
      siteSetting.contact = this.normalizeContact(dto.contact);
    }

    if (dto.socialLinks !== undefined) {
      siteSetting.socialLinks = this.normalizeSocialLinks(dto.socialLinks);
    }
  }

  private toContactPanel(siteSetting: SiteSettingEntity): ContactPanelResponse {
    const addressValue = this.pickLocalized(siteSetting.address);
    const openTimeRaw = this.pickLocalized(siteSetting.openTime);
    const openTimeLines = this.splitLines(openTimeRaw);

    const preferredContact = siteSetting.contact?.en ?? siteSetting.contact?.km ?? null;
    const phones = this.uniqueStrings(preferredContact?.phones ?? []);
    const desks = this.buildPanelDesks(preferredContact?.desks ?? []);
    const links = this.normalizeSocialLinks(siteSetting.socialLinks) ?? [];

    return {
      address: {
        title: 'Address',
        value: addressValue,
      },
      contact: {
        title: 'Contact',
        phones,
        desks,
      },
      openTime: {
        title: 'Open Time',
        days: openTimeLines[0] ?? null,
        hours: openTimeLines.length > 1 ? openTimeLines.slice(1).join(' ') : null,
        raw: openTimeRaw,
      },
      stayConnected: {
        title: 'Stay Connected',
        links,
      },
      mapEmbedUrl: null,
      updatedAt: siteSetting.updatedAt,
    };
  }

  private buildPanelDesks(desks: SiteContactDeskValue[]): ContactPanelDesk[] {
    return desks
      .map((desk, index) => {
        const label = this.normalizeText(desk?.title) ?? `Desk ${index + 1}`;
        const emails = this.uniqueStrings(desk?.emails ?? []);
        if (!emails.length) {
          return null;
        }

        return {
          key: this.toDeskKey(label) || `desk${index + 1}`,
          label,
          emails,
        };
      })
      .filter((desk): desk is ContactPanelDesk => Boolean(desk));
  }

  private normalizeLocalizedText(
    value: LocalizedTextValue | null | undefined,
    fieldName: string,
    requireAtLeastOne = false,
  ): LocalizedTextValue | null {
    const en = this.normalizeText(value?.en);
    const km = this.normalizeText(value?.km);

    if (requireAtLeastOne && !en && !km) {
      throw new BadRequestException(`${fieldName}.en or ${fieldName}.km is required`);
    }

    if (!en && !km) {
      return null;
    }

    return {
      ...(en ? { en } : {}),
      ...(km ? { km } : {}),
    };
  }

  private normalizeContact(value: SiteContactValue | null | undefined): SiteContactValue | null {
    const en = this.normalizeContactLanguage(value?.en);
    const km = this.normalizeContactLanguage(value?.km);

    if (!en && !km) {
      return null;
    }

    return {
      ...(en ? { en } : {}),
      ...(km ? { km } : {}),
    };
  }

  private normalizeContactLanguage(value?: SiteContactLanguageValue | null): SiteContactLanguageValue | null {
    if (!value) {
      return null;
    }

    const phones = this.uniqueStrings(value.phones ?? []);
    const desks = (value.desks ?? [])
      .map((desk, index) => {
        const title = this.normalizeText(desk?.title) ?? `Desk ${index + 1}`;
        const emails = this.uniqueStrings(desk?.emails ?? []);
        if (!emails.length) {
          return null;
        }
        return { title, emails };
      })
      .filter((desk): desk is SiteContactDeskValue => Boolean(desk));

    if (!phones.length && !desks.length) {
      return null;
    }

    return { phones, desks };
  }

  private normalizeSocialLinks(value: SiteSocialLinkValue[] | null | undefined): SiteSocialLinkValue[] | null {
    if (!value) {
      return null;
    }

    const normalized = value
      .map((item) => {
        const icon = this.normalizeText(item?.icon);
        const title = this.normalizeText(item?.title);
        const url = this.normalizeText(item?.url);
        if (!icon || !title || !url) {
          return null;
        }
        return { icon, title, url };
      })
      .filter((item): item is SiteSocialLinkValue => Boolean(item));

    return normalized.length ? normalized : null;
  }

  private toDeskKey(value?: string | null): string {
    const normalized = this.normalizeText(value);
    if (!normalized) {
      return '';
    }
    return normalized.toLowerCase().replace(/[^a-z]/g, '');
  }

  private pickLocalized(value?: LocalizedTextValue | null): string | null {
    return this.normalizeText(value?.en) ?? this.normalizeText(value?.km);
  }

  private uniqueStrings(values: Array<string | null | undefined>): string[] {
    const set = new Set<string>();
    for (const value of values) {
      const normalized = this.normalizeText(value);
      if (normalized) {
        set.add(normalized);
      }
    }
    return Array.from(set);
  }

  private splitLines(value?: string | null): string[] {
    if (!value) {
      return [];
    }
    return value
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
  }

  private normalizeText(value?: string | null): string | null {
    if (value === null || value === undefined) {
      return null;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  private async uploadLogo(file: UploadedFilePayload): Promise<string> {
    const key = this.generateObjectKey(file.originalname);
    const filePath = path.join(process.cwd(), key);
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, file.buffer);
    return `/${key}`;
  }

  private generateObjectKey(originalName: string): string {
    const rawExt = originalName && originalName.includes('.') ? originalName.split('.').pop() : 'bin';
    const ext = (rawExt || 'bin').replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || 'bin';
    const random = Math.random().toString(36).slice(2);
    const stamp = Date.now();
    const uploadRoot = this.getUploadRoot();
    return `${uploadRoot}/site-settings/${stamp}-${random}.${ext}`;
  }

  private removeLocalFile(url: string): void {
    const relativePath = this.toRelativePath(url).replace(/^\/+/, '');
    const uploadRootPath = path.resolve(process.cwd(), this.getUploadRoot());
    const absolutePath = path.resolve(process.cwd(), relativePath);

    if (absolutePath !== uploadRootPath && !absolutePath.startsWith(`${uploadRootPath}${path.sep}`)) {
      return;
    }

    if (fs.existsSync(absolutePath)) {
      fs.unlinkSync(absolutePath);
    }
  }

  private toRelativePath(url: string): string {
    try {
      return new URL(url).pathname;
    } catch {
      return url;
    }
  }

  private getUploadRoot(): string {
    return (process.env.LOCAL_UPLOAD_PATH || 'uploads').replace(/^\/+|\/+$/g, '');
  }
}
