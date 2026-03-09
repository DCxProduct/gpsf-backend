import {
  Body,
  Controller,
  Post,
  Res,
  Req,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import type { Response, Request } from 'express';
import { AuthService } from './auth.service';
import { CreateUserDto } from './dto/create-user.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ResendResetEmailDto } from './dto/resend-reset-email.dto';
import { UsersService } from '../users/users.service';
import { IUserResponse } from '../users/types/userResponse.interface';
import { AuthGuard } from './guards/auth.guard';
import { ActivityLogsService } from '@/modules/activity-logs/activity-logs.service';
import { ActivityLogModulePath } from '@/modules/activity-logs/activity-log.constants';
import type { AuthRequest } from '@/types/expressRequest.interface';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
    private readonly activityLogsService: ActivityLogsService,
  ) {}

  @Post('register')
  @UsePipes(new ValidationPipe())
  async register(
    @Body('user') dto: CreateUserDto,
    @Req() req: AuthRequest,
  ): Promise<IUserResponse> {
    const response = await this.authService.register(dto);
    // Write the log after registration succeeds, so failed log writes do not block the user flow.
    await this.activityLogsService.log({
      kind: 'register',
      activity: 'User registered',
      module: ActivityLogModulePath.auth,
      resource: 'auth',
      actor: {
        id: response.user.id,
        username: response.user.username,
        email: response.user.email,
        image: response.user.image ?? null,
      },
      target: {
        id: response.user.id,
        type: 'user',
        label: response.user.username,
        url: `/users/${response.user.id}`,
      },
      metadata: this.activityLogsService.buildRequestMetadata(req),
    });
    return response;
  }

  @Post('login')
  @UsePipes(new ValidationPipe())
  async login(
    @Body('user') dto: LoginDto,
    @Req() req: AuthRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<IUserResponse> {
    const user = await this.authService.login(dto);
    const response = await this.usersService.generateUserResponse(user);

    this.attachAuthCookies(res, response);
    // Login logs are useful for the activity table and basic audit history.
    await this.activityLogsService.log({
      kind: 'login',
      activity: 'User logged in',
      module: ActivityLogModulePath.auth,
      resource: 'auth',
      actor: user,
      target: {
        id: user.id,
        type: 'user',
        label: user.username,
        url: `/users/${user.id}`,
      },
      metadata: this.activityLogsService.buildRequestMetadata(req),
    });
    return response;
  }

  @Post('forgot-password')
  @UsePipes(new ValidationPipe())
  async forgotPassword(@Body() dto: ForgotPasswordDto, @Req() req: Request): Promise<{ message: string }> {
    await this.authService.forgotPassword(dto);
    await this.activityLogsService.log({
      kind: 'forgot_password',
      activity: 'Password reset requested',
      module: ActivityLogModulePath.auth,
      resource: 'auth',
      target: {
        type: 'auth',
        label: dto.email,
      },
      metadata: {
        ...(this.activityLogsService.buildRequestMetadata(req) ?? {}),
        email: dto.email,
      },
    });
    return { message: 'If that email exists, a reset link has been sent.' };
  }

  @Post('forgot-password/resend')
  @UsePipes(new ValidationPipe())
  async resendForgotPassword(@Body() dto: ResendResetEmailDto, @Req() req: Request): Promise<{ message: string }> {
    await this.authService.resendPasswordReset(dto);
    await this.activityLogsService.log({
      kind: 'forgot_password',
      activity: 'Password reset email resent',
      module: ActivityLogModulePath.auth,
      resource: 'auth',
      target: {
        type: 'auth',
        label: dto.email,
      },
      metadata: {
        ...(this.activityLogsService.buildRequestMetadata(req) ?? {}),
        email: dto.email,
      },
    });
    return { message: 'If a reset request exists, a new email was sent.' };
  }

  @Post('reset-password')
  @UsePipes(new ValidationPipe())
  async resetPassword(@Body() dto: ResetPasswordDto, @Req() req: Request): Promise<IUserResponse> {
    const user = await this.authService.resetPassword(dto);
    const response = await this.usersService.generateUserResponse(user);
    await this.activityLogsService.log({
      kind: 'reset_password',
      activity: 'Password reset completed',
      module: ActivityLogModulePath.auth,
      resource: 'auth',
      actor: user,
      target: {
        id: user.id,
        type: 'user',
        label: user.username,
        url: `/users/${user.id}`,
      },
      metadata: this.activityLogsService.buildRequestMetadata(req),
    });
    return response;
  }

  @Post('logout')
  @UseGuards(AuthGuard)
  async logout(@Res({ passthrough: true }) res: Response): Promise<{ ok: boolean }> {
    res.clearCookie('access_token', { path: '/' });
    res.clearCookie('refresh_token', { path: '/' });
    return { ok: true };
  }

  @Post('refresh')
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<IUserResponse> {
    const refreshToken = (req as any).cookies?.['refresh_token'] as string | undefined;
    const user = await this.authService.refreshAccessToken(refreshToken ?? '');
    const response = await this.usersService.generateUserResponse(user);

    this.attachAuthCookies(res, response);
    return response;
  }

  private attachAuthCookies(res: Response, response: IUserResponse): void {
    res.cookie('access_token', response.user.token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
      path: '/',
      maxAge: 15 * 60 * 1000,
    });

    res.cookie('refresh_token', (response.user as any).refreshToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
  }
}
