import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  HttpException,
  HttpStatus,
  Inject,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import * as argon2 from 'argon2';
import { createHash, randomBytes } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import Redis from 'ioredis';
import { User, Plan } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { JwtPayload, ResetTokenPayload } from './interfaces/jwt-payload.interface';

// ─── Response types ────────────────────────────────────────────────────────────

type UserWithPlan = User & { plan: Plan | null };

interface UserProfile {
  id: number;
  email: string;
  username: string;
  fullName: string | null;
  phoneNumber: string | null;
  role: string;
  termsAccepted: boolean;
  termsAcceptedAt: Date | null;
  personalDataConsent: boolean;
  personalDataConsentAt: Date | null;
  plan: { slug: string; name: string; level: number } | null;
}

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  user: UserProfile;
}

export interface TokensResponse {
  access_token: string;
  refresh_token: string;
}

// ─── Service ───────────────────────────────────────────────────────────────────

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
    @InjectQueue('email') private readonly emailQueue: Queue,
  ) {}

  // ─── LOGIN ─────────────────────────────────────────────────────────────────

  async login(
    dto: LoginDto,
    ip: string,
    userAgent: string,
  ): Promise<AuthResponse> {
    // Find user by email
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: { plan: true },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.blocked) {
      throw new UnauthorizedException('Tài khoản của bạn đã bị khóa. Vui lòng liên hệ hỗ trợ.');
    }

    // Verify password
    const isPasswordValid = await argon2.verify(user.passwordHash, dto.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Generate tokens
    const tokens = await this.generateTokens(user);

    // Save refresh token hash
    await this.saveRefreshToken(user.id, tokens.refresh_token, ip, userAgent);

    // Audit log
    await this.writeAuditLog(user.id, 'LOGIN', 'auth', ip, userAgent);

    return {
      ...tokens,
      user: this.buildUserProfile(user),
    };
  }

  // ─── REGISTER ──────────────────────────────────────────────────────────────

  async register(dto: RegisterDto): Promise<AuthResponse> {
    // Validate confirmPassword matches password
    if (dto.password !== dto.confirmPassword) {
      throw new BadRequestException('Mật khẩu xác nhận không khớp');
    }

    if (dto.termsAccepted !== true) {
      throw new BadRequestException('Bạn cần đồng ý với điều khoản sử dụng và cho phép xử lý thông tin cá nhân');
    }

    // Check email uniqueness
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existing) {
      throw new ConflictException('Email đã được sử dụng');
    }

    // Hash password with argon2id
    const passwordHash = await argon2.hash(dto.password, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 1,
    });

    const consentAcceptedAt = new Date();

    // Create user
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        username: dto.username,
        fullName: dto.fullName ?? null,
        phoneNumber: dto.phoneNumber ?? null,
        passwordHash,
        role: 'user',
        planId: null,
        termsAccepted: true,
        termsAcceptedAt: consentAcceptedAt,
        personalDataConsent: true,
        personalDataConsentAt: consentAcceptedAt,
      },
      include: { plan: true },
    });

    // Generate tokens
    const tokens = await this.generateTokens(user);

    // Save refresh token
    await this.saveRefreshToken(user.id, tokens.refresh_token, null, null);

    return {
      ...tokens,
      user: this.buildUserProfile(user),
    };
  }

  // ─── REFRESH ───────────────────────────────────────────────────────────────

  async refresh(
    refreshToken: string,
    ip: string,
    userAgent: string,
  ): Promise<TokensResponse> {
    const tokenHash = this.hashToken(refreshToken);

    // Find valid refresh token
    const storedToken = await this.prisma.refreshToken.findFirst({
      where: {
        tokenHash,
        // Remove revokedAt: null to detect reuse
      },
      include: {
        user: { include: { plan: true } },
      },
    });

    if (!storedToken || storedToken.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    if (storedToken.revokedAt !== null) {
      // Breach detected: Token reuse! Revoke all tokens for this user.
      await this.prisma.refreshToken.updateMany({
        where: { userId: storedToken.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException('Security alert: Token reuse detected. All sessions revoked.');
    }

    if (storedToken.user.blocked) {
      throw new UnauthorizedException('Tài khoản của bạn đã bị khóa. Vui lòng liên hệ hỗ trợ.');
    }

    // Single-use rotation: soft-delete old + generate new in parallel
    const [tokens] = await Promise.all([
      this.generateTokens(storedToken.user),
      this.prisma.refreshToken.update({
        where: { id: storedToken.id },
        data: { revokedAt: new Date() },
      }),
    ]);

    await this.saveRefreshToken(storedToken.userId, tokens.refresh_token, ip, userAgent);

    return tokens;
  }

  // ─── LOGOUT ────────────────────────────────────────────────────────────────

  async logout(userId: number, refreshToken: string): Promise<void> {
    const tokenHash = this.hashToken(refreshToken);

    // Revoke the specific refresh token
    await this.prisma.refreshToken.updateMany({
      where: {
        tokenHash,
        userId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });

    // Audit log
    await this.writeAuditLog(userId, 'LOGOUT', 'auth', null, null);
  }

  // ─── CHANGE PASSWORD ──────────────────────────────────────────────────────

  async changePassword(userId: number, dto: ChangePasswordDto): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Verify old password
    const isOldPasswordValid = await argon2.verify(user.passwordHash, dto.oldPassword);
    if (!isOldPasswordValid) {
      throw new UnauthorizedException('Mật khẩu cũ không chính xác');
    }

    // Hash new password
    const passwordHash = await argon2.hash(dto.newPassword, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 1,
    });

    // Update password and invalidate all sessions
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: {
          passwordHash,
          passwordChangedAt: new Date(),
        },
      }),
      this.prisma.refreshToken.deleteMany({
        where: { userId },
      }),
    ]);

    // Audit log
    await this.writeAuditLog(userId, 'CHANGE_PASSWORD', 'auth', null, null);
  }

  // ─── FORGOT PASSWORD ──────────────────────────────────────────────────────

  async forgotPassword(email: string): Promise<{ message: string }> {
    // Always return the same response to prevent email enumeration
    const response = { message: 'Nếu email tồn tại, mã OTP đã được gửi' };

    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return response;
    }

    // FIX: Use crypto.randomBytes for cryptographically secure OTP
    const otp = parseInt(randomBytes(3).toString('hex'), 16) % 900000 + 100000;

    // FIX: Pipeline Redis operations — 3 commands in 1 round-trip
    const pipeline = this.redis.pipeline();
    pipeline.set(`otp:${email}`, otp.toString(), 'EX', 600);
    pipeline.set(`otp_attempts:${email}`, '0', 'EX', 600);
    await pipeline.exec();

    // Dispatch email job via BullMQ
    await this.emailQueue.add('send_otp', {
      to: email,
      subject: 'Mã OTP đặt lại mật khẩu',
      otp,
    });

    this.logger.log(`OTP dispatched for email: ${email}`);

    return response;
  }

  // ─── VERIFY OTP ────────────────────────────────────────────────────────────

  async verifyOtp(email: string, otp: string): Promise<{ reset_token: string }> {
    // FIX: Pipeline Redis operations — get attempts + get OTP in single round-trip
    const pipeline = this.redis.pipeline();
    pipeline.get(`otp_attempts:${email}`);
    pipeline.get(`otp:${email}`);
    const results = await pipeline.exec();
    if (!results) {
      throw new BadRequestException('OTP đã hết hạn');
    }
    const attemptsStr = String(results[0]?.[1] ?? '');
    const storedOtp = results[1]?.[1] as string | null;

    const attempts = parseInt(attemptsStr, 10);

    if (attempts >= 5) {
      await this.redis.del(`otp:${email}`, `otp_attempts:${email}`);
      throw new HttpException(
        'Quá nhiều lần thử. Vui lòng yêu cầu OTP mới',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Increment attempt counter (separate to avoid race)
    await this.redis.incr(`otp_attempts:${email}`);

    if (!storedOtp) {
      throw new BadRequestException('OTP đã hết hạn');
    }

    // FIX: Timing-safe comparison using crypto
    const { timingSafeEqual } = await import('crypto');
    const storedOtpBuffer = Buffer.from(storedOtp, 'utf8');
    const submittedOtpBuffer = Buffer.from(otp, 'utf8');
    const match =
      storedOtpBuffer.length === submittedOtpBuffer.length &&
      timingSafeEqual(storedOtpBuffer, submittedOtpBuffer);

    if (!match) {
      throw new BadRequestException('Mã OTP không hợp lệ');
    }

    // Clean up Redis
    await this.redis.del(`otp:${email}`, `otp_attempts:${email}`);

    // Find user
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new BadRequestException('OTP đã hết hạn');
    }

    // Generate reset token (short-lived JWT with purpose claim)
    const jti = uuidv4();
    const resetToken = this.jwtService.sign(
      {
        sub: user.id,
        purpose: 'reset_password',
        jti,
      },
      { expiresIn: '10m' },
    );

    return { reset_token: resetToken };
  }

  // ─── RESET PASSWORD ───────────────────────────────────────────────────────

  async resetPassword(resetToken: string, newPassword: string): Promise<void> {
    // Verify the reset token
    let payload: ResetTokenPayload;
    try {
      payload = this.jwtService.verify<ResetTokenPayload>(resetToken);
    } catch {
      throw new UnauthorizedException('Token không hợp lệ hoặc đã hết hạn');
    }

    // Check purpose
    if (payload.purpose !== 'reset_password') {
      throw new UnauthorizedException('Token không hợp lệ');
    }

    // Check if token has been used (blacklisted)
    const isBlacklisted = await this.redis.get(`blacklist:${payload.jti}`);
    if (isBlacklisted) {
      throw new UnauthorizedException('Token đã được sử dụng');
    }

    // Hash new password
    const passwordHash = await argon2.hash(newPassword, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 1,
    });

    // Update password and invalidate all sessions
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: payload.sub },
        data: {
          passwordHash,
          passwordChangedAt: new Date(),
        },
      }),
      this.prisma.refreshToken.deleteMany({
        where: { userId: payload.sub },
      }),
    ]);

    // Blacklist the reset token for its remaining lifetime
    const remainingTtl = payload.exp - Math.floor(Date.now() / 1000);
    if (remainingTtl > 0) {
      await this.redis.set(`blacklist:${payload.jti}`, '1', 'EX', remainingTtl);
    }

    // Audit log
    await this.writeAuditLog(payload.sub, 'RESET_PASSWORD', 'auth', null, null);
  }

  // ─── TOKEN GENERATION ─────────────────────────────────────────────────────

  async generateTokens(user: UserWithPlan): Promise<TokensResponse> {
    const jti = uuidv4();

    const jwtPayload: Omit<JwtPayload, 'iat' | 'exp'> = {
      sub: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
      planSlug: user.plan?.slug ?? null,
      planLevel: user.plan?.level ?? 0,
      jti,
    };

    const accessToken = this.jwtService.sign(jwtPayload);

    // Refresh token is an opaque string, NOT a JWT
    const refreshToken = `${uuidv4()}-${uuidv4()}`;

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
    };
  }

  // ─── PRIVATE HELPERS ──────────────────────────────────────────────────────

  /**
   * SHA-256 hash a token string for secure storage.
   */
  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  /**
   * Save a hashed refresh token to the database.
   */
  private async saveRefreshToken(
    userId: number,
    rawToken: string,
    ip: string | null,
    userAgent: string | null,
  ): Promise<void> {
    const tokenHash = this.hashToken(rawToken);
    const expiresIn = this.configService.get<string>('jwt.refreshExpiresIn', '7d');
    const expiresAt = new Date(Date.now() + this.parseExpiryToMs(expiresIn));

    await this.prisma.refreshToken.create({
      data: {
        tokenHash,
        userId,
        expiresAt,
        ipAddress: ip,
        userAgent: userAgent,
      },
    });
  }

  /**
   * Parse a duration string like "7d", "15m", "1h" to milliseconds.
   */
  private parseExpiryToMs(expiry: string): number {
    const match = expiry.match(/^(\d+)([smhd])$/);
    if (!match) {
      return 7 * 24 * 60 * 60 * 1000; // default 7 days
    }
    const value = parseInt(match[1], 10);
    const unit = match[2];
    const multipliers: Record<string, number> = {
      s: 1000,
      m: 60 * 1000,
      h: 60 * 60 * 1000,
      d: 24 * 60 * 60 * 1000,
    };
    return value * (multipliers[unit] ?? multipliers['d']);
  }

  /**
   * Build a safe user profile object (no sensitive fields).
   */
  private buildUserProfile(user: UserWithPlan): UserProfile {
    return {
      id: user.id,
      email: user.email,
      username: user.username,
      fullName: user.fullName ?? null,
      phoneNumber: user.phoneNumber ?? null,
      role: user.role,
      termsAccepted: user.termsAccepted,
      termsAcceptedAt: user.termsAcceptedAt,
      personalDataConsent: user.personalDataConsent,
      personalDataConsentAt: user.personalDataConsentAt,
      plan: user.plan
        ? {
            slug: user.plan.slug,
            name: user.plan.name,
            level: user.plan.level,
          }
        : null,
    };
  }

  // FIX: Fire-and-forget audit log via BullMQ queue — non-blocking
  private writeAuditLog(
    userId: number | null,
    action: string,
    resource: string,
    ipAddress: string | null,
    userAgent: string | null,
  ): void {
    this.emailQueue
      .add(
        'audit_log',
        { userId, action, resource, ipAddress, userAgent },
        { attempts: 3, backoff: { type: 'exponential', delay: 1000 } },
      )
      .catch((error: Error) => {
        this.logger.error(`Failed to queue audit log: ${error.message}`);
      });
  }
}
