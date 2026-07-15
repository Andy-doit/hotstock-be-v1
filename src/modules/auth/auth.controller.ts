import {
  Controller,
  Post,
  Body,
  Req,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { FastifyReply, FastifyRequest } from 'fastify';
import { AuthService, AuthResponse, TokensResponse } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from './interfaces/jwt-payload.interface';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  private getCookieValue(
    request: FastifyRequest,
    name: string,
  ): string | undefined {
    const cookieHeader = request.headers.cookie;
    if (!cookieHeader) return undefined;

    const cookie = cookieHeader
      .split(';')
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${name}=`));

    return cookie
      ? decodeURIComponent(cookie.slice(name.length + 1))
      : undefined;
  }

  private serializeCookie(name: string, value: string, maxAge: number): string {
    const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
    return `${name}=${encodeURIComponent(value)}; Max-Age=${maxAge}; Path=/; HttpOnly; SameSite=Strict${secure}`;
  }

  private setAuthCookies(reply: FastifyReply, tokens: TokensResponse): void {
    reply.header('Set-Cookie', [
      this.serializeCookie('access_token', tokens.access_token, 15 * 60),
      this.serializeCookie('auth_token', '', 0),
      this.serializeCookie(
        'refresh_token',
        tokens.refresh_token,
        7 * 24 * 60 * 60,
      ),
    ]);
  }

  private clearAuthCookies(reply: FastifyReply): void {
    reply.header('Set-Cookie', [
      this.serializeCookie('access_token', '', 0),
      this.serializeCookie('auth_token', '', 0),
      this.serializeCookie('refresh_token', '', 0),
    ]);
  }

  // ─── LOGIN ─────────────────────────────────────────────────────────────────

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ medium: { limit: 10, ttl: 60000 } })
  @ApiOperation({
    summary: 'Đăng nhập',
    description: 'Đăng nhập bằng email và mật khẩu',
  })
  @ApiResponse({ status: 200, description: 'Đăng nhập thành công' })
  @ApiResponse({
    status: 401,
    description: 'Email hoặc mật khẩu không chính xác',
  })
  @ApiResponse({ status: 429, description: 'Quá nhiều yêu cầu' })
  async login(
    @Body() dto: LoginDto,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<AuthResponse> {
    const ip = request.ip;
    const userAgent = request.headers['user-agent'] ?? '';
    const response = await this.authService.login(dto, ip, userAgent);
    this.setAuthCookies(reply, response);
    return response;
  }

  // ─── REGISTER ──────────────────────────────────────────────────────────────

  @Post('register')
  @Throttle({ medium: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Đăng ký', description: 'Tạo tài khoản mới' })
  @ApiResponse({ status: 201, description: 'Đăng ký thành công' })
  @ApiResponse({ status: 409, description: 'Email đã được sử dụng' })
  @ApiResponse({ status: 429, description: 'Quá nhiều yêu cầu' })
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<AuthResponse> {
    const response = await this.authService.register(dto);
    this.setAuthCookies(reply, response);
    return response;
  }

  // ─── REFRESH TOKEN ─────────────────────────────────────────────────────────

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Làm mới token',
    description: 'Đổi refresh token lấy cặp token mới',
  })
  @ApiResponse({ status: 200, description: 'Token mới được cấp' })
  @ApiResponse({ status: 401, description: 'Refresh token không hợp lệ' })
  async refresh(
    @Body() dto: RefreshTokenDto,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<TokensResponse> {
    const ip = request.ip;
    const userAgent = request.headers['user-agent'] ?? '';
    const refreshToken =
      dto.refresh_token ?? this.getCookieValue(request, 'refresh_token');
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token is required');
    }

    const response = await this.authService.refresh(
      refreshToken,
      ip,
      userAgent,
    );
    this.setAuthCookies(reply, response);
    return response;
  }

  // ─── LOGOUT ────────────────────────────────────────────────────────────────

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Đăng xuất', description: 'Thu hồi refresh token' })
  @ApiResponse({ status: 200, description: 'Đăng xuất thành công' })
  @ApiResponse({ status: 401, description: 'Chưa đăng nhập' })
  async logout(
    @CurrentUser() user: JwtPayload,
    @Body() dto: RefreshTokenDto,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<{ message: string }> {
    const refreshToken =
      dto.refresh_token ?? this.getCookieValue(request, 'refresh_token');
    if (refreshToken) {
      await this.authService.logout(user.sub, refreshToken);
    }
    this.clearAuthCookies(reply);
    return { message: 'Đăng xuất thành công' };
  }

  // ─── CHANGE PASSWORD ──────────────────────────────────────────────────────

  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Đổi mật khẩu',
    description: 'Đổi mật khẩu (cần đăng nhập)',
  })
  @ApiResponse({ status: 200, description: 'Đổi mật khẩu thành công' })
  @ApiResponse({ status: 401, description: 'Mật khẩu cũ không chính xác' })
  async changePassword(
    @CurrentUser() user: JwtPayload,
    @Body() dto: ChangePasswordDto,
  ): Promise<{ message: string }> {
    await this.authService.changePassword(user.sub, dto);
    return { message: 'Đổi mật khẩu thành công' };
  }

  // ─── FORGOT PASSWORD ──────────────────────────────────────────────────────

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({ long: { limit: 3, ttl: 600000 } })
  @ApiOperation({
    summary: 'Quên mật khẩu',
    description: 'Gửi mã OTP đặt lại mật khẩu qua email',
  })
  @ApiResponse({
    status: 200,
    description: 'Nếu email tồn tại, mã OTP đã được gửi',
  })
  @ApiResponse({ status: 429, description: 'Quá nhiều yêu cầu' })
  async forgotPassword(
    @Body() dto: ForgotPasswordDto,
  ): Promise<{ message: string }> {
    return this.authService.forgotPassword(dto.email);
  }

  // ─── VERIFY OTP ────────────────────────────────────────────────────────────

  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  @Throttle({ long: { limit: 5, ttl: 600000 } })
  @ApiOperation({
    summary: 'Xác minh OTP',
    description: 'Xác minh mã OTP và nhận reset token',
  })
  @ApiResponse({ status: 200, description: 'OTP hợp lệ, trả về reset token' })
  @ApiResponse({ status: 400, description: 'OTP không hợp lệ hoặc hết hạn' })
  @ApiResponse({ status: 429, description: 'Quá nhiều lần thử' })
  async verifyOtp(@Body() dto: VerifyOtpDto): Promise<{ reset_token: string }> {
    return this.authService.verifyOtp(dto.email, dto.otp);
  }

  // ─── RESET PASSWORD ───────────────────────────────────────────────────────

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Đặt lại mật khẩu',
    description: 'Đặt lại mật khẩu bằng reset token',
  })
  @ApiResponse({ status: 200, description: 'Đặt lại mật khẩu thành công' })
  @ApiResponse({
    status: 401,
    description: 'Token không hợp lệ hoặc đã hết hạn',
  })
  async resetPassword(
    @Body() dto: ResetPasswordDto,
  ): Promise<{ message: string }> {
    await this.authService.resetPassword(dto.resetToken, dto.newPassword);
    return { message: 'Đặt lại mật khẩu thành công' };
  }
}
