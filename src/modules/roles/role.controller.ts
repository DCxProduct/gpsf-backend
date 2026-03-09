import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    Patch,
    Post,
    Put,
    UseGuards,
    UsePipes,
    ValidationPipe,
    ParseIntPipe,
} from '@nestjs/common';
import { RoleService } from './role.service';
import { AuthGuard } from '@/modules/auth/guards/auth.guard';
import { PermissionsGuard } from './guards/permissions.guard';
import { Permissions } from './decorator/permissions.decorator';
import { Resource } from './enums/resource.enum';
import { Action } from './enums/actions.enum';
import { CreateRoleDto, UpdateRoleDto, UpdateRolePermissionsDto } from './dto/role.dto';
import { User } from '@/modules/auth/decorators/user.decorator';
import { ActivityLogsService } from '@/modules/activity-logs/activity-logs.service';
import { ActivityLogModulePath } from '@/modules/activity-logs/activity-log.constants';

@Controller('roles')
export class RoleController {
    constructor(
        private readonly roleService: RoleService,
        private readonly activityLogsService: ActivityLogsService,
    ) {}

    @Get()
    @UseGuards(AuthGuard, PermissionsGuard)
    @Permissions({ resource: Resource.Roles, actions: [Action.Read] })
    async listRoles() {
        return this.roleService.listRoles();
    }

    @Get('resources/definition')
    @UseGuards(AuthGuard, PermissionsGuard)
    @Permissions({ resource: Resource.Roles, actions: [Action.Read] })
    async getResourceDefinitions() {
        return this.roleService.getResourceDefinitions();
    }

    @Get('me/permissions')
    @UseGuards(AuthGuard)
    async getMyPermissions(@User('role') role: string | undefined) {
        if (!role) {
            return {};
        }
        return this.roleService.getPermissionMapForRole(role);
    }

    @Get(':id')
    @UseGuards(AuthGuard, PermissionsGuard)
    @Permissions({ resource: Resource.Roles, actions: [Action.Read] })
    async getRoleById(@Param('id', ParseIntPipe) id: number) {
        return this.roleService.getRoleDetailById(id);
    }

    @Post()
    @UseGuards(AuthGuard, PermissionsGuard)
    @Permissions({ resource: Resource.Roles, actions: [Action.Create] })
    @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
    async createRole(@User() actor: any, @Body() dto: CreateRoleDto) {
        const roleDetail = await this.roleService.createRole(dto);
        // Role rows link back to the role detail page for the "Open Content" action.
        await this.activityLogsService.log({
            kind: 'created',
            activity: 'Role created',
            module: ActivityLogModulePath.role,
            resource: 'roles',
            actor,
            target: {
                id: roleDetail.role.id,
                type: 'role',
                label: roleDetail.role.name,
                url: `/roles/${roleDetail.role.id}`,
            },
        });
        return roleDetail;
    }

    @Patch(':id')
    @UseGuards(AuthGuard, PermissionsGuard)
    @Permissions({ resource: Resource.Roles, actions: [Action.Update] })
    @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
    async updateRole(@User() actor: any, @Param('id', ParseIntPipe) id: number, @Body() dto: UpdateRoleDto) {
        // Read old role detail first so the log can show a readable before/after diff.
        const before = await this.roleService.getRoleDetailById(id);
        const roleDetail = await this.roleService.updateRole(id, dto);
        await this.activityLogsService.log({
            kind: 'updated',
            activity: 'Role updated',
            module: ActivityLogModulePath.role,
            resource: 'roles',
            actor,
            target: {
                id: roleDetail.role.id,
                type: 'role',
                label: roleDetail.role.name,
                url: `/roles/${roleDetail.role.id}`,
            },
            changes: this.activityLogsService.buildChanges(
                before as unknown as Record<string, unknown>,
                roleDetail as unknown as Record<string, unknown>,
            ),
        });
        return roleDetail;
    }

    @Put(':id/permissions')
    @UseGuards(AuthGuard, PermissionsGuard)
    @Permissions({ resource: Resource.Roles, actions: [Action.Update] })
    @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
    async updatePermissions(@User() actor: any, @Param('id', ParseIntPipe) id: number, @Body() dto: UpdateRolePermissionsDto) {
        // Permission update only compares the matrix/stats because that is the real edited payload.
        const before = await this.roleService.getRoleDetailById(id);
        const roleDetail = await this.roleService.updatePermissions(id, dto);
        await this.activityLogsService.log({
            kind: 'updated',
            activity: 'Role permissions updated',
            module: ActivityLogModulePath.role,
            resource: 'roles',
            actor,
            target: {
                id: roleDetail.role.id,
                type: 'role',
                label: roleDetail.role.name,
                url: `/roles/${roleDetail.role.id}`,
            },
            changes: this.activityLogsService.buildChanges(
                { matrix: before.matrix, stats: before.stats },
                { matrix: roleDetail.matrix, stats: roleDetail.stats },
            ),
        });
        return roleDetail;
    }

    @Delete(':id')
    @UseGuards(AuthGuard, PermissionsGuard)
    @Permissions({ resource: Resource.Roles, actions: [Action.Delete] })
    async deleteRole(@User() actor: any, @Param('id', ParseIntPipe) id: number) {
        // Capture role detail before delete so the log still has a useful label.
        const roleDetail = await this.roleService.getRoleDetailById(id);
        await this.roleService.deleteRole(id);
        await this.activityLogsService.log({
            kind: 'deleted',
            activity: 'Role deleted',
            module: ActivityLogModulePath.role,
            resource: 'roles',
            actor,
            target: {
                id,
                type: 'role',
                label: roleDetail.role.name,
                url: `/roles/${id}`,
            },
        });
        return { message: `Role '${id}' deleted.` };
    }
}
