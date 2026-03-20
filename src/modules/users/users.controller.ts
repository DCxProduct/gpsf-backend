import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { IUserResponse } from './types/userResponse.interface';
import { AuthGuard } from '../auth/guards/auth.guard';
import { PermissionsGuard } from '../roles/guards/permissions.guard';
import { Permissions } from '../roles/decorator/permissions.decorator';
import { Resource } from '../roles/enums/resource.enum';
import { Action } from '../roles/enums/actions.enum';
import { User } from '../auth/decorators/user.decorator';
import { UpdateUserDto } from './dto/update-user.dto';
import { AdminCreateUserDto } from './dto/admin-create-user.dto';
import { UpdateRolePermissionsDto } from '../roles/dto/role.dto';
import { ActivityLogsService } from '@/modules/activity-logs/activity-logs.service';
import { ActivityLogModulePath } from '@/modules/activity-logs/activity-log.constants';

@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly activityLogsService: ActivityLogsService,
  ) {}

  @Get()
  @UseGuards(AuthGuard, PermissionsGuard)
  @Permissions({ resource: Resource.Users, actions: [Action.Read] })
  // admin-only checkbox: needs users.read to list everyone
  async getUsers() {
    return await this.usersService.findAll();
  }

  @Get('me')
  @UseGuards(AuthGuard)
  async getCurrentUser(@User() user): Promise<IUserResponse> {
    return await this.usersService.generateUserResponse(user);
  }

  @Get(':id')
  @UseGuards(AuthGuard, PermissionsGuard)
  @Permissions({ resource: Resource.Users, actions: [Action.Read] })
  // same read permission lets admins fetch a single user
  async getUserById(@Param('id', ParseIntPipe) id: number) {
    return await this.usersService.getAdminUserProfile(id);
  }

  @Put('me')
  @UseGuards(AuthGuard, PermissionsGuard)
  @Permissions({ resource: Resource.Users, actions: [Action.Update] })
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
  async updateCurrentUser(
    @User() actor: any,
    @User('id') userId: number,
    @Body('user') updateUserDto: UpdateUserDto,
  ): Promise<IUserResponse> {
    // Read before + after so the activity detail can show exactly what changed.
    const before = await this.usersService.getAdminUserProfile(userId);
    const user = await this.usersService.updateUser(userId, updateUserDto);
    const response = await this.usersService.generateUserResponse(user);
    const after = await this.usersService.getAdminUserProfile(userId);
    await this.activityLogsService.log({
      kind: 'updated',
      activity: 'User record updated',
      module: ActivityLogModulePath.user,
      resource: 'users',
      actor,
      target: {
        id: userId,
        type: 'user',
        label: after.username,
        url: `/users/${userId}`,
      },
      changes: this.activityLogsService.buildChanges(
        before as unknown as Record<string, unknown>,
        after as unknown as Record<string, unknown>,
      ),
    });
    return response;
  }

  @Post()
  @UseGuards(AuthGuard, PermissionsGuard)
  @Permissions({ resource: Resource.Users, actions: [Action.Create] })
  // checkbox combo users.create gives admin the “Create user” button
  @UsePipes(new ValidationPipe())
  async adminCreateUser(
    @User() actor: any,
    @Body('user') dto: AdminCreateUserDto,
  ): Promise<IUserResponse> {
    const user = await this.usersService.adminCreateUser(dto);
    const response = await this.usersService.generateUserResponse(user);
    // New user logs point back to the target profile page for the table action menu.
    await this.activityLogsService.log({
      kind: 'created',
      activity: 'User account created',
      module: ActivityLogModulePath.user,
      resource: 'users',
      actor,
      target: {
        id: user.id,
        type: 'user',
        label: user.username,
        url: `/users/${user.id}`,
      },
    });
    return response;
  }

  @Put(':id')
  @UseGuards(AuthGuard, PermissionsGuard)
  @Permissions({ resource: Resource.Users, actions: [Action.Update] })
  // users.update toggles the edit checkbox, letting admin change roles via UI
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
  async adminUpdateUser(
    @User() actor: any,
    @Param('id') id: string,
    @Body('user') dto: UpdateUserDto,
  ): Promise<IUserResponse> {
    const userId = Number(id);
    // Admin update uses the same before/after pattern as self update.
    const before = await this.usersService.getAdminUserProfile(userId);
    const user = await this.usersService.adminUpdateUser(userId, dto);
    const response = await this.usersService.generateUserResponse(user);
    const after = await this.usersService.getAdminUserProfile(userId);
    await this.activityLogsService.log({
      kind: 'updated',
      activity: 'User record updated',
      module: ActivityLogModulePath.user,
      resource: 'users',
      actor,
      target: {
        id: user.id,
        type: 'user',
        label: after.username,
        url: `/users/${user.id}`,
      },
      changes: this.activityLogsService.buildChanges(
        before as unknown as Record<string, unknown>,
        after as unknown as Record<string, unknown>,
      ),
    });
    return response;
  }

  @Put(':id/permissions')
  @UseGuards(AuthGuard, PermissionsGuard)
  @Permissions(
    { resource: Resource.Users, actions: [Action.Update] },
    { resource: Resource.Roles, actions: [Action.Update] },
  )
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
  async adminAssignPermissions(
    @User() actor: any,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateRolePermissionsDto,
  ) {
    // combine users.update + roles.update checkboxes: clone/update a custom role for this user
    // Only log the role + permission map because that is the part the admin changed here.
    const before = await this.usersService.getAdminUserProfile(id);
    const response = await this.usersService.assignPermissionsToUser(id, dto);
    const after = await this.usersService.getAdminUserProfile(id);
    await this.activityLogsService.log({
      kind: 'updated',
      activity: 'User permissions updated',
      module: ActivityLogModulePath.user,
      resource: 'users',
      actor,
      target: {
        id,
        type: 'user',
        label: after.username,
        url: `/users/${id}`,
      },
      changes: this.activityLogsService.buildChanges(
        { role: before.role, permissions: before.permissions },
        { role: after.role, permissions: after.permissions },
      ),
    });
    return response;
  }

  @Delete(':id')
  @UseGuards(AuthGuard, PermissionsGuard)
  @Permissions({ resource: Resource.Users, actions: [Action.Delete] })
  // users.delete checkbox removes the “Delete user” option
  async adminDeleteUser(@User() actor: any, @Param('id') id: string) {
    const userId = Number(id);
    // Keep a copy of the user label before removing the row from the database.
    const before = await this.usersService.getAdminUserProfile(userId);
    await this.usersService.adminDeleteUser(userId);
    await this.activityLogsService.log({
      kind: 'deleted',
      activity: 'User deleted',
      module: ActivityLogModulePath.user,
      resource: 'users',
      actor,
      target: {
        id: userId,
        type: 'user',
        label: before.username,
        url: `/users/${userId}`,
      },
    });
    return { message: 'User deleted successfully' };
  }
}
