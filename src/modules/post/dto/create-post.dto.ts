import {IsEnum, IsInt, IsNotEmpty, IsObject, IsOptional, IsString, Max, MaxLength, Min} from 'class-validator';
import {PostStatus} from '@/modules/post/post.entity';
import {Transform, Type} from 'class-transformer';

export class CreatePostDto {
    @IsString()
    @IsNotEmpty()
    @MaxLength(200)
    title: string;

    @IsOptional()
    @Transform(({value}) => {
        if (value === undefined || value === '') {
            return undefined;
        }
        if (value === null) {
            return null;
        }
        if (typeof value === 'string') {
            try {
                return JSON.parse(value);
            } catch {
                return value;
            }
        }
        return value;
    })
    @IsObject()
    content?: Record<string, unknown> | null;

    // Optional relations
    @IsOptional()
    @Transform(({value}) => (value === '' ? undefined : value))
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(2147483647)
    categoryId?: number;

    @IsOptional()
    @Transform(({value}) => (value === '' ? undefined : value))
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(2147483647)
    pageId?: number;

    @IsOptional()
    @IsEnum(PostStatus)
    status?: PostStatus;
}
