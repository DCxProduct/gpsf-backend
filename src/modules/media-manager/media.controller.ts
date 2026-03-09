import {
    Body,
    BadRequestException,
    Controller,
    Delete,
    Get,
    Param,
    ParseIntPipe,
    Post,
    Query,
    UploadedFiles,
    UseGuards,
    UseInterceptors,
    UsePipes,
    ValidationPipe,
} from "@nestjs/common";
import {FilesInterceptor} from "@nestjs/platform-express";
import {MediaService} from "@/modules/media-manager/media.service";
import {MediasResponseInterface} from "@/modules/media-manager/types/medias-response-interface";
import { CreateMediaFolderDto } from '@/modules/media-manager/dto/create-media-folder.dto';
import { AuthGuard } from '@/modules/auth/guards/auth.guard';
import { PermissionsGuard } from '@/modules/roles/guards/permissions.guard';
import { Permissions } from '@/modules/roles/decorator/permissions.decorator';
import { Resource } from '@/modules/roles/enums/resource.enum';
import { Action } from '@/modules/roles/enums/actions.enum';
import { ActivityLogsService } from '@/modules/activity-logs/activity-logs.service';
import { ActivityLogModulePath } from '@/modules/activity-logs/activity-log.constants';
import { User } from '@/modules/auth/decorators/user.decorator';
import { UserEntity } from '@/modules/users/entities/user.entity';


@Controller('media')
export class MediaController {
    constructor(
        private readonly mediaService: MediaService,
        private readonly activityLogsService: ActivityLogsService,
    ) {
    }

    //Get all Item in media
    @Get()
    @UseGuards(AuthGuard, PermissionsGuard)
    @Permissions({ resource: Resource.Media, actions: [Action.Read] })
    findAll(
        @Query('page') page?: number,
        @Query('pageSize') pageSize?: number,
        @Query('folderId') folderId?: string,
    ): Promise<MediasResponseInterface> {
        const normalizedFolderId = this.parseFolderId(folderId, true);
        return this.mediaService.findAll(page, pageSize, normalizedFolderId).then((result) => ({
            success: true,
            message: 'OK',
            ...result,
        }));
    }

    @Get('folders')
    @UseGuards(AuthGuard, PermissionsGuard)
    @Permissions({ resource: Resource.Media, actions: [Action.Read] })
    listFolders() {
        return this.mediaService.listFolders().then((data) => ({
            success: true,
            message: 'OK',
            data,
        }));
    }

    @Get('folders/:id')
    @UseGuards(AuthGuard, PermissionsGuard)
    @Permissions({ resource: Resource.Media, actions: [Action.Read] })
    findFolderById(
        @Param('id', ParseIntPipe) id: number,
        @Query('page') page?: number,
        @Query('pageSize') pageSize?: number,
    ) {
        return this.mediaService.findFolderWithItems(id, page, pageSize).then((result) => ({
            success: true,
            message: 'OK',
            ...result,
        }));
    }

    @Post('folders')
    @UseGuards(AuthGuard, PermissionsGuard)
    @Permissions({ resource: Resource.Media, actions: [Action.Create] })
    @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
    createFolder(@User() user: UserEntity, @Body() dto: CreateMediaFolderDto) {
        return this.mediaService.createFolder(dto.name).then(async (data) => {
            // Folder creation is logged after the directory and DB row are both ready.
            await this.activityLogsService.log({
                kind: 'created',
                activity: 'Media folder created',
                module: ActivityLogModulePath.media,
                resource: 'media',
                actor: user,
                target: {
                    id: data.id,
                    type: 'media-folder',
                    label: data.name,
                    url: `/media/folders/${data.id}`,
                },
            });
            return ({
            success: true,
            message: 'Folder created successfully',
            data,
        });
        });
    }

    @Delete('folders/:id')
    @UseGuards(AuthGuard, PermissionsGuard)
    @Permissions({ resource: Resource.Media, actions: [Action.Delete] })
    async deleteFolder(
        @User() user: UserEntity,
        @Param('id', ParseIntPipe) id: number,
        @Query('force') force?: string,
    ) {
        const shouldForceDelete = String(force ?? '')
            .trim()
            .toLowerCase();
        const isForce = shouldForceDelete === 'true' || shouldForceDelete === '1';

        // Read folder name first because the row disappears after delete.
        const folder = await this.mediaService.findFolderWithItems(id, 1, 1);
        const result = await this.mediaService.deleteFolder(id, isForce);
        await this.activityLogsService.log({
            kind: 'deleted',
            activity: 'Media folder deleted',
            module: ActivityLogModulePath.media,
            resource: 'media',
            actor: user,
            target: {
                id,
                type: 'media-folder',
                label: folder.folder.name,
                url: `/media/folders/${id}`,
            },
            metadata: isForce ? { deletedItemsCount: result.deletedItemsCount } : null,
        });
        return {
            success: true,
            message: isForce
                ? `Folder deleted successfully (${result.deletedItemsCount} item(s) removed)`
                : 'Folder deleted successfully',
        };
    }

    //Get by id
    @Get(':id')
    @UseGuards(AuthGuard, PermissionsGuard)
    @Permissions({ resource: Resource.Media, actions: [Action.Read] })
    findOne(@Param('id', ParseIntPipe) id: number) {
        return this.mediaService.findOne(id);
    }

    //Create media
    @Post('upload')
    @UseGuards(AuthGuard, PermissionsGuard)
    @Permissions({ resource: Resource.Media, actions: [Action.Create] })
    @UseInterceptors(FilesInterceptor('files', 20))
    uploadToRoot(
        @User() user: UserEntity,
        @UploadedFiles() files: Express.Multer.File[],
    ) {
        if (!files?.length) {
            throw new BadRequestException('At least one file is required');
        }
        return this.mediaService.upload(files, null).then(async (items) => {
            const first = items[0];
            // For batch upload, log one summary row instead of one row per file.
            await this.activityLogsService.log({
                kind: 'created',
                activity: items.length > 1 ? 'Media assets created' : 'Media file created',
                module: ActivityLogModulePath.media,
                resource: 'media',
                actor: user,
                target: {
                    id: first?.id ?? null,
                    type: 'media',
                    label: items.length > 1 ? `${items.length} files` : (first?.filename ?? 'Media file'),
                    url: items.length === 1 && first ? `/media/${first.id}` : null,
                },
                metadata: items.length > 1 ? { itemIds: items.map((item) => item.id) } : null,
            });
            return items;
        });
    }

    //Create media in folder
    @Post('upload/folders/:folderId')
    @UseGuards(AuthGuard, PermissionsGuard)
    @Permissions({ resource: Resource.Media, actions: [Action.Create] })
    @UseInterceptors(FilesInterceptor('files', 20))
    uploadToFolder(
        @User() user: UserEntity,
        @Param('folderId', ParseIntPipe) folderId: number,
        @UploadedFiles() files: Express.Multer.File[],
    ) {
        if (!files?.length) {
            throw new BadRequestException('At least one file is required');
        }
        return this.mediaService.upload(files, folderId).then(async (items) => {
            const first = items[0];
            // Keep folderId in metadata so frontend can trace where the upload happened.
            await this.activityLogsService.log({
                kind: 'created',
                activity: items.length > 1 ? 'Media assets created' : 'Media file created',
                module: ActivityLogModulePath.media,
                resource: 'media',
                actor: user,
                target: {
                    id: first?.id ?? null,
                    type: 'media',
                    label: items.length > 1 ? `${items.length} files` : (first?.filename ?? 'Media file'),
                    url: items.length === 1 && first ? `/media/${first.id}` : null,
                },
                metadata: {
                    folderId,
                    itemIds: items.map((item) => item.id),
                },
            });
            return items;
        });
    }

    //Delete something in media
    @Delete(':id')
    @UseGuards(AuthGuard, PermissionsGuard)
    @Permissions({ resource: Resource.Media, actions: [Action.Delete] })
    async remove(@User() user: UserEntity, @Param('id', ParseIntPipe) id: number) {
        // Read the media row first so the deleted log still knows the filename.
        const media = await this.mediaService.findOne(id);
        const result = await this.mediaService.remove(id);
        await this.activityLogsService.log({
            kind: 'deleted',
            activity: 'Media file deleted',
            module: ActivityLogModulePath.media,
            resource: 'media',
            actor: user,
            target: {
                id: media.id,
                type: 'media',
                label: media.filename,
                url: `/media/${media.id}`,
            },
        });
        return result;
    }

    private parseFolderId(
        value?: string | number,
        allowNull = false,
    ): number | null | undefined {
        if (value === undefined) {
            return undefined;
        }

        const raw = String(value).trim().toLowerCase();
        if (!raw || raw === 'root' || raw === 'null') {
            return allowNull ? null : undefined;
        }

        const parsed = Number(raw);
        if (!Number.isInteger(parsed) || parsed < 1) {
            throw new BadRequestException('folderId must be a positive integer');
        }

        return parsed;
    }
}
