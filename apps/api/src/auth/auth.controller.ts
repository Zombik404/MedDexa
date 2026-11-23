import { Body, Controller, Headers, HttpCode, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { limit } from '../common/throttle';
import {
  forgotPasswordSchema,
  loginSchema,
  refreshSchema,
  registerSchema,
  resetPasswordSchema,
  type LoginInput,
  type RegisterInput,
} from '@meddexa/shared';
import { CurrentUser, RequireAuth, type RequestUser } from '../common/decorators';
import { ZodPipe } from '../common/zod.pipe';
import { AuthService } from './auth.service';

@ApiTags('auth')
@Controller('auth')
@Throttle(limit(10))
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  register(@Body(new ZodPipe(registerSchema)) body: RegisterInput, @Headers('user-agent') ua?: string) {
    return this.auth.register(body, ua);
  }

  @Post('login')
  @HttpCode(200)
  login(@Body(new ZodPipe(loginSchema)) body: LoginInput, @Headers('user-agent') ua?: string) {
    return this.auth.login(body, ua);
  }

  @Post('refresh')
  @HttpCode(200)
  @Throttle(limit(30))
  refresh(@Body(new ZodPipe(refreshSchema)) body: { refreshToken: string }, @Headers('user-agent') ua?: string) {
    return this.auth.refresh(body.refreshToken, ua);
  }

  @Post('logout')
  @HttpCode(204)
  async logout(@Body(new ZodPipe(refreshSchema)) body: { refreshToken: string }) {
    await this.auth.logout(body.refreshToken);
  }

  @Post('logout-all')
  @HttpCode(204)
  @RequireAuth()
  async logoutAll(@CurrentUser() user: RequestUser) {
    await this.auth.logoutAll(user.id);
  }

  @Post('forgot-password')
  @HttpCode(202)
  @Throttle(limit(3))
  async forgot(@Body(new ZodPipe(forgotPasswordSchema)) body: { email: string }) {
    await this.auth.forgotPassword(body.email);
    return { accepted: true };
  }

  @Post('reset-password')
  @HttpCode(204)
  async reset(@Body(new ZodPipe(resetPasswordSchema)) body: { token: string; password: string }) {
    await this.auth.resetPassword(body.token, body.password);
  }
}
