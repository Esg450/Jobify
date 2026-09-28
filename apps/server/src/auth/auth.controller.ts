import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { LoginDto, RegisterDto, SetupDto } from './auth.dto.js';
import { AuthService } from './auth.service.js';
import { Public } from './decorators.js';
import { clearSessionCookie, readSessionCookie, setSessionCookie } from './session-cookie.js';
import { SessionsService } from './sessions.service.js';

@Public()
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly sessions: SessionsService,
  ) {}

  @Get('status')
  status(@Req() request: Request) {
    return this.auth.status(readSessionCookie(request));
  }

  @Post('setup')
  @UseGuards(ThrottlerGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async setup(
    @Body() dto: SetupDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    setSessionCookie(request, response, await this.auth.setup(dto));
  }

  @Post('login')
  @UseGuards(ThrottlerGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async login(
    @Body() dto: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    setSessionCookie(request, response, await this.auth.login(dto));
  }

  @Post('register')
  @UseGuards(ThrottlerGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async register(
    @Body() dto: RegisterDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    setSessionCookie(request, response, await this.auth.register(dto));
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const token = readSessionCookie(request);
    if (token) await this.sessions.revoke(token);
    clearSessionCookie(response);
  }
}
