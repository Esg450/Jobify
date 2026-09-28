import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { IsString, MaxLength } from 'class-validator';
import type { Request, Response } from 'express';
import { AuthService, SESSION_COOKIE, SESSION_TTL_MS } from './auth.service.js';
import { Public } from './public.decorator.js';

class LoginDto {
  @IsString()
  @MaxLength(500)
  password!: string;
}

@Public()
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Get('status')
  status(@Req() request: Request) {
    const token = (request.cookies as Record<string, string> | undefined)?.[SESSION_COOKIE];
    return { enabled: this.auth.enabled, authenticated: this.auth.isValidSession(token) };
  }

  @Post('login')
  @UseGuards(ThrottlerGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  login(
    @Body() dto: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    if (!this.auth.enabled) return;
    if (!this.auth.verifyPassword(dto.password))
      throw new UnauthorizedException('Incorrect password');

    response.cookie(SESSION_COOKIE, this.auth.createSession(), {
      httpOnly: true,
      sameSite: 'lax',
      secure: request.secure,
      maxAge: SESSION_TTL_MS,
    });
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  logout(@Res({ passthrough: true }) response: Response) {
    response.clearCookie(SESSION_COOKIE);
  }
}
