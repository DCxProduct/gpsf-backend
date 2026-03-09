import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put, UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';
import { MenuService } from '@/modules/menu/menu.service';
import { CreateMenuDto } from '@/modules/menu/dto/create-menu.dto';
import { UpdateMenuDto } from '@/modules/menu/dto/update-menu.dto';
import { CreateMenuItemDto } from '@/modules/menu/dto/create-menu-item.dto';
import { UpdateMenuItemDto } from '@/modules/menu/dto/update-menu-item.dto';
import { AuthGuard } from '@/modules/auth/guards/auth.guard';
import { PermissionsGuard } from '@/modules/roles/guards/permissions.guard';
import { Permissions } from '@/modules/roles/decorator/permissions.decorator';
import { Resource } from '@/modules/roles/enums/resource.enum';
import { Action } from '@/modules/roles/enums/actions.enum';
import { ActivityLogsService } from '@/modules/activity-logs/activity-logs.service';
import { ActivityLogModulePath } from '@/modules/activity-logs/activity-log.constants';
import { User } from '@/modules/auth/decorators/user.decorator';
import { UserEntity } from '@/modules/users/entities/user.entity';

@Controller('menus')
export class MenuController {
  constructor(
    private readonly menuService: MenuService,
    private readonly activityLogsService: ActivityLogsService,
  ) {}

  // Menus
  @Get()
  async findAll() {
    const menus = await this.menuService.findAllMenus();
    return menus.map((m) => ({
      id: m.id,
      name: m.name,
      slug: m.slug,
      createdAt: m.createdAt,
      updatedAt: m.updatedAt,
    }));
  }

  @Get('slug/:slug')
  async findTreeBySlug(@Param('slug') slug: string) {
    return await this.menuService.getMenuItemsBySlug(slug);
  }

  @Get('slug/:slug/tree')
  async findMenuWithTree(@Param('slug') slug: string) {
    return await this.menuService.getMenuWithTreeBySlug(slug);
  }

  @Get('tree')
  async findAllWithItems() {
    return await this.menuService.findAllMenusWithItems();
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    const m = await this.menuService.findMenuById(id);
    return {
      id: m.id,
      name: m.name,
      slug: m.slug,
      createdAt: m.createdAt,
      updatedAt: m.updatedAt,
    };
  }

  @Post()
  @UseGuards(AuthGuard, PermissionsGuard)
  @Permissions({ resource: Resource.Menu, actions: [Action.Create] })
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
  async create(@User() user: UserEntity, @Body() dto: CreateMenuDto) {
    const m = await this.menuService.createMenu(dto);
    // Log after create so the menu already has its final id/slug.
    await this.activityLogsService.log({
      kind: 'created',
      activity: 'Menu created',
      module: ActivityLogModulePath.menu,
      resource: 'menu',
      actor: user,
      target: {
        id: m.id,
        type: 'menu',
        label: m.name,
        url: `/menus/${m.id}`,
      },
    });
    return {
      id: m.id,
      name: m.name,
      slug: m.slug,
      createdAt: m.createdAt,
      updatedAt: m.updatedAt,
    };
  }

  @Put(':id')
  @UseGuards(AuthGuard, PermissionsGuard)
  @Permissions({ resource: Resource.Menu, actions: [Action.Update] })
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
  async update(@User() user: UserEntity, @Param('id', ParseIntPipe) id: number, @Body() dto: UpdateMenuDto) {
    // Capture the current menu state first for the before/after diff.
    const before = await this.menuService.findMenuById(id);
    const m = await this.menuService.updateMenu(id, dto);
    await this.activityLogsService.log({
      kind: 'updated',
      activity: 'Menu updated',
      module: ActivityLogModulePath.menu,
      resource: 'menu',
      actor: user,
      target: {
        id: m.id,
        type: 'menu',
        label: m.name,
        url: `/menus/${m.id}`,
      },
      changes: this.activityLogsService.buildChanges(
        { name: before.name, slug: before.slug },
        { name: m.name, slug: m.slug },
      ),
    });
    return {
      id: m.id,
      name: m.name,
      slug: m.slug,
      createdAt: m.createdAt,
      updatedAt: m.updatedAt,
    };
  }

  @Delete(':id')
  @UseGuards(AuthGuard, PermissionsGuard)
  @Permissions({ resource: Resource.Menu, actions: [Action.Delete] })
  async remove(@User() user: UserEntity, @Param('id', ParseIntPipe) id: number) {
    // Keep the menu name before delete for a readable activity row.
    const menu = await this.menuService.findMenuById(id);
    await this.menuService.removeMenu(id);
    await this.activityLogsService.log({
      kind: 'deleted',
      activity: 'Menu deleted',
      module: ActivityLogModulePath.menu,
      resource: 'menu',
      actor: user,
      target: {
        id: menu.id,
        type: 'menu',
        label: menu.name,
        url: `/menus/${menu.id}`,
      },
    });
    return { message: 'Menu deleted' };
  }

  // Menu Items
  @Get(':menuId/items')
  async getItems(@Param('menuId', ParseIntPipe) menuId: number) {
    return await this.menuService.getMenuItems(menuId);
  }

  @Post(':menuId/items')
  @UseGuards(AuthGuard, PermissionsGuard)
  @Permissions({ resource: Resource.Menu, actions: [Action.Create] })
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
  async createItem(@User() user: UserEntity, @Param('menuId', ParseIntPipe) menuId: number, @Body() dto: CreateMenuItemDto) {
    const i = await this.menuService.createMenuItem(menuId, dto);
    // Menu items use their nested route in the target URL so frontend can open them directly.
    await this.activityLogsService.log({
      kind: 'created',
      activity: 'Menu item created',
      module: ActivityLogModulePath.menu,
      resource: 'menu',
      actor: user,
      target: {
        id: i.id,
        type: 'menu-item',
        label: this.toMenuItemLabel(i.label),
        url: `/menus/${menuId}/items/${i.id}`,
      },
    });
    return {
      id: i.id,
      label: i.label,
      url: i.url ?? null,
      orderIndex: i.orderIndex,
      parentId: i.parent ? i.parent.id : null,
      createdAt: i.createdAt,
      updatedAt: i.updatedAt,
    };
  }

  @Put(':menuId/items/:id')
  @UseGuards(AuthGuard, PermissionsGuard)
  @Permissions({ resource: Resource.Menu, actions: [Action.Update] })
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
  async updateItem(
    @User() user: UserEntity,
    @Param('menuId', ParseIntPipe) menuId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateMenuItemDto,
  ) {
    // Load the existing tree first so we can find the item snapshot by id.
    const before = this.findMenuItemNode(await this.menuService.getMenuItems(menuId), id);
    const i = await this.menuService.updateMenuItem(menuId, id, dto);
    await this.activityLogsService.log({
      kind: 'updated',
      activity: 'Menu item updated',
      module: ActivityLogModulePath.menu,
      resource: 'menu',
      actor: user,
      target: {
        id: i.id,
        type: 'menu-item',
        label: this.toMenuItemLabel(i.label),
        url: `/menus/${menuId}/items/${i.id}`,
      },
      changes: this.activityLogsService.buildChanges(
        before ?? null,
        {
          label: i.label,
          url: i.url ?? null,
          orderIndex: i.orderIndex,
          parentId: i.parent ? i.parent.id : null,
        },
      ),
    });
    return {
      id: i.id,
      label: i.label,
      url: i.url ?? null,
      orderIndex: i.orderIndex,
      parentId: i.parent ? i.parent.id : null,
      createdAt: i.createdAt,
      updatedAt: i.updatedAt,
    };
  }

  @Delete(':menuId/items/:id')
  @UseGuards(AuthGuard, PermissionsGuard)
  @Permissions({ resource: Resource.Menu, actions: [Action.Delete] })
  async removeItem(@User() user: UserEntity, @Param('menuId', ParseIntPipe) menuId: number, @Param('id', ParseIntPipe) id: number) {
    // Read the item from the current tree before delete because the row is removed afterwards.
    const before = this.findMenuItemNode(await this.menuService.getMenuItems(menuId), id);
    await this.menuService.removeMenuItem(menuId, id);
    await this.activityLogsService.log({
      kind: 'deleted',
      activity: 'Menu item deleted',
      module: ActivityLogModulePath.menu,
      resource: 'menu',
      actor: user,
      target: {
        id,
        type: 'menu-item',
        label: this.toMenuItemLabel((before?.label as { en?: string | null; km?: string | null } | string | null | undefined) ?? null),
        url: `/menus/${menuId}/items/${id}`,
      },
    });
    return { message: 'Menu item deleted' };
  }

  private findMenuItemNode(items: any[], id: number): Record<string, unknown> | null {
    // Walk the menu tree recursively until we find the target item.
    for (const item of items) {
      if (item.id === id) {
        return {
          label: item.label ?? null,
          url: item.url ?? null,
          orderIndex: item.orderIndex ?? null,
          parentId: item.parentId ?? null,
        };
      }
      const child = this.findMenuItemNode(item.children ?? [], id);
      if (child) {
        return child;
      }
    }
    return null;
  }

  private toMenuItemLabel(label: { en?: string | null; km?: string | null } | string | null | undefined): string {
    // Menu labels can be localized JSON or plain string depending on the response shape.
    if (typeof label === 'string') {
      return label || 'Menu item';
    }
    return label?.en || label?.km || 'Menu item';
  }
}
