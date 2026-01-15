import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SiteSettingEntity } from '@/modules/site-setting/site-setting.entity';
import { CreateSiteSettingDto } from '@/modules/site-setting/dto/create-site-setting.dto';
import { UpdateSiteSettingDto } from '@/modules/site-setting/dto/update-site-setting.dto';
import { UploadedFilePayload } from '@/types/uploaded-file.type';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class SiteSettingService {
  constructor(
    @InjectRepository(SiteSettingEntity)
    private readonly siteSettingRepository: Repository<SiteSettingEntity>,
  ) {}

  async create(dto: CreateSiteSettingDto, file?: UploadedFilePayload | null): Promise<SiteSettingEntity> {
    const siteSetting = this.siteSettingRepository.create(dto);
    if (file?.buffer) {
      siteSetting.siteLogo = await this.uploadLogo(file);
    }
    return await this.siteSettingRepository.save(siteSetting);
  }

  async findAll(): Promise<SiteSettingEntity[]> {
    return await this.siteSettingRepository.find({ order: { createdAt: 'DESC' } });
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
    Object.assign(siteSetting, dto);
    if (file?.buffer) {
      siteSetting.siteLogo = await this.uploadLogo(file);
    }
    return await this.siteSettingRepository.save(siteSetting);
  }

  async remove(id: number): Promise<void> {
    const siteSetting = await this.findOne(id);
    await this.siteSettingRepository.remove(siteSetting);
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
    const ext = originalName && originalName.includes('.') ? originalName.split('.').pop() : 'bin';
    const random = Math.random().toString(36).slice(2);
    const stamp = Date.now();
    return `uploads/site-settings/${stamp}-${random}.${ext}`;
  }
}
