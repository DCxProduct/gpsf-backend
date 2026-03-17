import { HttpException, HttpStatus, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Repository } from "typeorm";
import { CategoryEntity } from "@/modules/category/category.entity";
import { CreateCategoryDto } from "@/modules/category/dto/create-category.dto";
import { UpdateCategoryDto } from "@/modules/category/dto/update-category.dto";
import { UserEntity } from "@/modules/users/entities/user.entity";
import { PostEntity } from "@/modules/post/post.entity";
import { PageEntity } from '@/modules/page/page.entity';

export interface CategoryRelationPage {
    id: number;
    title: { en?: string; km?: string } | null;
    slug: string | null;
}

export interface CategoryRelationSection {
    id: number;
    pageId: number;
    blockType: string;
    title: { en?: string; km?: string } | null;
}

export interface CategoryRelationSummary {
    totalPosts: number;
    totalPages: number;
    totalSections: number;
    pages: CategoryRelationPage[];
    sections: CategoryRelationSection[];
}

@Injectable()
export class CategoryService {
    constructor(
        @InjectRepository(CategoryEntity)
        private readonly categoryRepository: Repository<CategoryEntity>,
        @InjectRepository(PostEntity)
        private readonly postRepository: Repository<PostEntity>,
        @InjectRepository(PageEntity)
        private readonly pageRepository: Repository<PageEntity>,
    ) {}

    async create(user: UserEntity, dto: CreateCategoryDto): Promise<CategoryEntity> {
        const existing = await this.categoryRepository.findOne({ where: { name: dto.name } });
        if (existing) {
            throw new HttpException('Category name already exists', HttpStatus.UNPROCESSABLE_ENTITY);
        }

        const category = this.categoryRepository.create({
            name: dto.name,
            description: dto.description,
            createdBy: user ?? null,
        });

        // Page links are managed directly by CMS so the sidebar does not depend on post data.
        category.pages = await this.resolvePages(dto.pageIds);

        return await this.categoryRepository.save(category);
    }

    async findAll(pageId?: number): Promise<CategoryEntity[]> {
        const qb = this.categoryRepository
            .createQueryBuilder('category')
            .distinct(true)
            .leftJoinAndSelect('category.createdBy', 'createdBy')
            .leftJoinAndSelect('category.pages', 'page')
            .orderBy('category.createdAt', 'DESC');

        if (pageId !== undefined) {
            qb.innerJoin('category.pages', 'filterPage', 'filterPage.id = :pageId', { pageId });
        }

        return await qb.getMany();
    }

    async findOne(id: number): Promise<CategoryEntity> {
        const category = await this.categoryRepository.findOne({ where: { id }, relations: ['createdBy', 'pages'] });
        if (!category) {
            throw new HttpException('Category not found', HttpStatus.NOT_FOUND);
        }
        return category;
    }

    async update(id: number, dto: UpdateCategoryDto): Promise<CategoryEntity> {
        const category = await this.findOne(id);

        if (dto.name !== undefined) {
            const mergedName = { ...(category.name ?? {}), ...dto.name };
            const exists = await this.categoryRepository.findOne({ where: { name: mergedName } });
            if (exists && exists.id !== id) {
                throw new HttpException('Category name already exists', HttpStatus.UNPROCESSABLE_ENTITY);
            }
            category.name = mergedName;
        }

        if (dto.description !== undefined) {
            category.description = { ...(category.description ?? {}), ...dto.description };
        }

        if (dto.pageIds !== undefined) {
            // An empty array means "clear all linked pages".
            category.pages = await this.resolvePages(dto.pageIds);
        }

        return await this.categoryRepository.save(category);
    }

    async remove(id: number): Promise<void> {
        const category = await this.findOne(id);
        await this.categoryRepository.remove(category);
    }

    async getRelationSummaries(categoryIds: number[]): Promise<Map<number, CategoryRelationSummary>> {
        const summaryMap = new Map<number, CategoryRelationSummary>();
        categoryIds.forEach((id) => {
            summaryMap.set(id, {
                totalPosts: 0,
                totalPages: 0,
                totalSections: 0,
                pages: [],
                sections: [],
            });
        });

        if (!categoryIds.length) {
            return summaryMap;
        }

        const posts = await this.postRepository.find({
            where: { category: { id: In(categoryIds) } },
            relations: ['category', 'page', 'section', 'sections'],
        });

        const pagesByCategory = new Map<number, Map<number, CategoryRelationPage>>();
        const sectionsByCategory = new Map<number, Map<number, CategoryRelationSection>>();

        posts.forEach((post) => {
            const categoryId = post.category?.id;
            if (!categoryId) {
                return;
            }

            const summary = summaryMap.get(categoryId);
            if (!summary) {
                return;
            }
            summary.totalPosts += 1;

            const categoryPages = pagesByCategory.get(categoryId) ?? new Map<number, CategoryRelationPage>();
            const categorySections = sectionsByCategory.get(categoryId) ?? new Map<number, CategoryRelationSection>();

            if (post.page?.id) {
                categoryPages.set(post.page.id, {
                    id: post.page.id,
                    title: post.page.title ?? null,
                    slug: post.page.slug ?? null,
                });
            }

            if (post.section?.id) {
                categorySections.set(post.section.id, {
                    id: post.section.id,
                    pageId: post.section.pageId,
                    blockType: post.section.blockType,
                    title: post.section.title ?? null,
                });
            }

            post.sections?.forEach((section) => {
                if (!section?.id) {
                    return;
                }
                categorySections.set(section.id, {
                    id: section.id,
                    pageId: section.pageId,
                    blockType: section.blockType,
                    title: section.title ?? null,
                });
            });

            pagesByCategory.set(categoryId, categoryPages);
            sectionsByCategory.set(categoryId, categorySections);
        });

        summaryMap.forEach((summary, categoryId) => {
            const pages = Array.from((pagesByCategory.get(categoryId) ?? new Map()).values());
            const sections = Array.from((sectionsByCategory.get(categoryId) ?? new Map()).values());

            summary.pages = pages;
            summary.sections = sections;
            summary.totalPages = pages.length;
            summary.totalSections = sections.length;
        });

        return summaryMap;
    }

    private async resolvePages(pageIds?: number[]): Promise<PageEntity[]> {
        if (pageIds === undefined) {
            return [];
        }

        if (!pageIds.length) {
            return [];
        }

        const uniqueIds = Array.from(new Set(pageIds));
        const pages = await this.pageRepository.find({ where: { id: In(uniqueIds) } });
        if (pages.length !== uniqueIds.length) {
            throw new HttpException('Page not found', HttpStatus.UNPROCESSABLE_ENTITY);
        }

        return pages;
    }

}
