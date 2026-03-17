import { BeforeUpdate, Column, CreateDateColumn, Entity, JoinTable, ManyToMany, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";
import { UserEntity } from "@/modules/users/entities/user.entity";
import { PageEntity } from '@/modules/page/page.entity';

@Entity({ name: 'categories' })
export class CategoryEntity {
  @PrimaryGeneratedColumn('increment')
  id: number;
  //Support english and khmer 
  @Column({ type: 'jsonb', unique: true })
  name: {
    en: string;
    km?: string;
  };
  @Column({ type: 'jsonb', nullable: true, default: () => "'{}'" })
  description?: {
    en: string;
    km?: string;
  };

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt: Date;

  @ManyToOne(() => UserEntity, { nullable: true, onDelete: 'SET NULL' })
  createdBy?: UserEntity | null;

  // Categories can be reused across many pages, and each page can expose many categories.
  @ManyToMany(() => PageEntity, (page) => page.categories)
  @JoinTable({
    name: 'page_categories',
    joinColumn: { name: 'categoryId', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'pageId', referencedColumnName: 'id' },
  })
  pages?: PageEntity[];

  @BeforeUpdate()
  updateTimestamp() {
    this.updatedAt = new Date();
  }
}
