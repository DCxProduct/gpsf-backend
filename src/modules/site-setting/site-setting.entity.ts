import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export interface LocalizedTextValue {
  en?: string;
  km?: string;
}

export interface SiteContactDeskValue {
  title: string;
  emails: string[];
}

export interface SiteContactLanguageValue {
  phones: string[];
  desks: SiteContactDeskValue[];
}

export interface SiteContactValue {
  en?: SiteContactLanguageValue;
  km?: SiteContactLanguageValue;
}

export interface SiteSocialLinkValue {
  icon: string;
  title: string;
  url: string;
}

@Entity({ name: 'site_settings' })
export class SiteSettingEntity {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column({ type: 'jsonb', nullable: true })
  title?: LocalizedTextValue | null;

  @Column({ type: 'jsonb', nullable: true })
  description?: LocalizedTextValue | null;

  @Column({ type: 'varchar', length: 600, nullable: true })
  logo?: string | null;

  @Column({ type: 'varchar', length: 600, nullable: true })
  footerBackground?: string | null;

  @Column({ type: 'jsonb', nullable: true })
  address?: LocalizedTextValue | null;

  @Column({ type: 'jsonb', nullable: true })
  contact?: SiteContactValue | null;

  @Column({ type: 'jsonb', nullable: true })
  openTime?: LocalizedTextValue | null;

  @Column({ type: 'jsonb', nullable: true })
  socialLinks?: SiteSocialLinkValue[] | null;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt: Date;
}
