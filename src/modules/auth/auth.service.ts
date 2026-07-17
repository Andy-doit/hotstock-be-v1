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
import { ResetTokenResponseDto } from './dto/auth-command-response.dto';
import { CommandMessageResponseDto } from '../../common/dto/command-response.dto';
import { getSafeErrorLogMessage } from '../../common/utils/log-redaction';
import {
  JwtPayload,
  ResetTokenPayload,
} from './interfaces/jwt-payload.interface';

type UserWithPlan = User & { plan: Plan | null };

const RESET_OTP_TTL_SECONDS = 600;
const RESET_OTP_MAX_ATTEMPTS = 5;

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

  async login(
    dto: LoginDto,
    ip: string,
    userAgent: string,
  ): Promise<AuthResponse> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: { plan: true },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.blocked) {
      throw new UnauthorizedException(
        'Tài khoản của bạn đã bị khóa. Vui lòng liên hệ hỗ trợ.',
      );
    }
    const isPasswordValid = await argon2.verify(
      user.passwordHash,
      dto.password,
    );
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const tokens = this.generateTokens(user);
    await this.saveRefreshToken(user.id, tokens.refresh_token, ip, userAgent);
    this.writeAuditLog(user.id, 'LOGIN', 'auth', ip, userAgent);

    return {
      ...tokens,
      user: this.buildUserProfile(user),
    };
  }

  async register(dto: RegisterDto): Promise<AuthResponse> {
    if (dto.password !== dto.confirmPassword) {
      throw new BadRequestException('Mật khẩu xác nhận không khớp');
    }

    if (dto.termsAccepted !== true) {
      throw new BadRequestException(
        'Bạn cần đồng ý với điều khoản sử dụng và cho phép xử lý thông tin cá nhân',
      );
    }
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existing) {
      throw new ConflictException('Email đã được sử dụng');
    }
    const passwordHash = await argon2.hash(dto.password, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 1,
    });

    const consentAcceptedAt = new Date();
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
    const tokens = this.generateTokens(user);
    await this.saveRefreshToken(user.id, tokens.refresh_token, null, null);

    return {
      ...tokens,
      user: this.buildUserProfile(user),
    };
  }

  async refresh(
    refreshToken: string,
    ip: string,
    userAgent: string,
  ): Promise<TokensResponse> {
    const tokenHash = this.hashToken(refreshToken);
    const storedToken = await this.prisma.refreshToken.findFirst({
      where: {
        tokenHash,
        // Revoked tokens stay queryable here so reuse can revoke every active session.
      },
      include: {
        user: { include: { plan: true } },
      },
    });

    if (!storedToken) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    if (storedToken.revokedAt !== null) {
      await this.rejectRefreshTokenReuse(storedToken.userId);
    }

    if (storedToken.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    if (storedToken.user.blocked) {
      throw new UnauthorizedException(
        'Tài khoản của bạn đã bị khóa. Vui lòng liên hệ hỗ trợ.',
      );
    }
    const tokens = this.generateTokens(storedToken.user);
    const newTokenHash = this.hashToken(tokens.refresh_token);
    const newTokenExpiresAt = this.getRefreshTokenExpiresAt();

    const tokenWasRotated = await this.prisma.$transaction(async (tx) => {
      const consumeResult = await tx.refreshToken.updateMany({
        where: {
          id: storedToken.id,
          revokedAt: null,
        },
        data: { revokedAt: new Date() },
      });

      if (consumeResult.count !== 1) {
        return false;
      }

      await tx.refreshToken.create({
        data: {
          tokenHash: newTokenHash,
          userId: storedToken.userId,
          expiresAt: newTokenExpiresAt,
          ipAddress: ip,
          userAgent,
        },
      });

      return true;
    });

    if (!tokenWasRotated) {
      const latestTokenState = await this.prisma.refreshToken.findUnique({
        where: { id: storedToken.id },
        select: { revokedAt: true },
      });

      if (latestTokenState && latestTokenState.revokedAt !== null) {
        await this.rejectRefreshTokenReuse(storedToken.userId);
      }

      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    return tokens;
  }

  async logout(userId: number, refreshToken: string): Promise<void> {
    const tokenHash = this.hashToken(refreshToken);
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
    this.writeAuditLog(userId, 'LOGOUT', 'auth', null, null);
  }

  async changePassword(userId: number, dto: ChangePasswordDto): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    const isOldPasswordValid = await argon2.verify(
      user.passwordHash,
      dto.oldPassword,
    );
    if (!isOldPasswordValid) {
      throw new UnauthorizedException('Mật khẩu cũ không chính xác');
    }
    const passwordHash = await argon2.hash(dto.newPassword, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 1,
    });
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
    this.writeAuditLog(userId, 'CHANGE_PASSWORD', 'auth', null, null);
  }

  async forgotPassword(email: string): Promise<CommandMessageResponseDto> {
    // Keep this response identical for existing and missing emails.
    const response = { message: 'Nếu email tồn tại, mã OTP đã được gửi' };

    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return response;
    }

    // OTPs must be generated with cryptographic randomness.
    const otp =
      (parseInt(randomBytes(3).toString('hex'), 16) % 900000) + 100000;

    const otpKey = `otp:${email}`;
    const attemptsKey = `otp_attempts:${email}`;
    const pipeline = this.redis.pipeline();
    pipeline.set(otpKey, otp.toString(), 'EX', RESET_OTP_TTL_SECONDS);
    pipeline.set(attemptsKey, '0', 'EX', RESET_OTP_TTL_SECONDS);
    await pipeline.exec();
    await this.emailQueue.add('send_otp', {
      to: email,
      subject: 'Mã OTP đặt lại mật khẩu',
      otp,
    });

    this.logger.log(`OTP dispatched for user id: ${user.id}`);

    return response;
  }

  async verifyOtp(email: string, otp: string): Promise<ResetTokenResponseDto> {
    const otpKey = `otp:${email}`;
    const attemptsKey = `otp_attempts:${email}`;
    const pipeline = this.redis.pipeline();
    pipeline.get(attemptsKey);
    pipeline.get(otpKey);
    pipeline.ttl(otpKey);
    const results = await pipeline.exec();
    if (!results) {
      throw new BadRequestException('OTP đã hết hạn');
    }
    const attemptsValue = results[0]?.[1];
    const attemptsStr = typeof attemptsValue === 'string' ? attemptsValue : '';
    const storedOtpValue = results[1]?.[1];
    const storedOtp =
      typeof storedOtpValue === 'string' ? storedOtpValue : null;
    const otpTtlValue = results[2]?.[1];
    const otpTtlSeconds =
      typeof otpTtlValue === 'number' && otpTtlValue > 0
        ? otpTtlValue
        : RESET_OTP_TTL_SECONDS;

    const parsedAttempts = parseInt(attemptsStr, 10);
    const attempts = Number.isFinite(parsedAttempts) ? parsedAttempts : 0;

    if (!storedOtp) {
      await this.redis.del(attemptsKey);
      throw new BadRequestException('OTP đã hết hạn');
    }

    if (attempts >= RESET_OTP_MAX_ATTEMPTS) {
      await this.redis.del(otpKey, attemptsKey);
      throw new HttpException(
        'Quá nhiều lần thử. Vui lòng yêu cầu OTP mới',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Count every verification attempt independently from OTP comparison.
    await this.incrementOtpAttempts(attemptsKey, otpTtlSeconds);

    // Avoid leaking OTP correctness through timing differences.
    const { timingSafeEqual } = await import('crypto');
    const storedOtpBuffer = Buffer.from(storedOtp, 'utf8');
    const submittedOtpBuffer = Buffer.from(otp, 'utf8');
    const match =
      storedOtpBuffer.length === submittedOtpBuffer.length &&
      timingSafeEqual(storedOtpBuffer, submittedOtpBuffer);

    if (!match) {
      throw new BadRequestException('Mã OTP không hợp lệ');
    }
    await this.redis.del(otpKey, attemptsKey);
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new BadRequestException('OTP đã hết hạn');
    }
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

  async resetPassword(resetToken: string, newPassword: string): Promise<void> {
    let payload: ResetTokenPayload;
    try {
      payload = this.jwtService.verify<ResetTokenPayload>(resetToken);
    } catch {
      throw new UnauthorizedException('Token không hợp lệ hoặc đã hết hạn');
    }
    if (payload.purpose !== 'reset_password') {
      throw new UnauthorizedException('Token không hợp lệ');
    }
    const isBlacklisted = await this.redis.get(`blacklist:${payload.jti}`);
    if (isBlacklisted) {
      throw new UnauthorizedException('Token đã được sử dụng');
    }
    const passwordHash = await argon2.hash(newPassword, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 1,
    });
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

    // Reset tokens are single-use for their remaining lifetime.
    const remainingTtl = payload.exp - Math.floor(Date.now() / 1000);
    if (remainingTtl > 0) {
      await this.redis.set(`blacklist:${payload.jti}`, '1', 'EX', remainingTtl);
    }
    this.writeAuditLog(payload.sub, 'RESET_PASSWORD', 'auth', null, null);
  }

  generateTokens(user: UserWithPlan): TokensResponse {
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

    // Refresh tokens are opaque credentials; only their hash is stored.
    const refreshToken = `${uuidv4()}-${uuidv4()}`;

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
    };
  }
  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
  private async incrementOtpAttempts(
    attemptsKey: string,
    ttlSeconds: number,
  ): Promise<void> {
    const boundedTtlSeconds =
      ttlSeconds > 0 ? ttlSeconds : RESET_OTP_TTL_SECONDS;
    const pipeline = this.redis.pipeline();
    pipeline.incr(attemptsKey);
    pipeline.expire(attemptsKey, boundedTtlSeconds);
    await pipeline.exec();
  }
  private async saveRefreshToken(
    userId: number,
    rawToken: string,
    ip: string | null,
    userAgent: string | null,
  ): Promise<void> {
    const tokenHash = this.hashToken(rawToken);
    const expiresAt = this.getRefreshTokenExpiresAt();

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
  private getRefreshTokenExpiresAt(): Date {
    const expiresIn = this.configService.get<string>(
      'jwt.refreshExpiresIn',
      '7d',
    );

    return new Date(Date.now() + this.parseExpiryToMs(expiresIn));
  }
  private async rejectRefreshTokenReuse(userId: number): Promise<never> {
    await this.revokeActiveRefreshTokens(userId);
    throw new UnauthorizedException(
      'Security alert: Token reuse detected. All sessions revoked.',
    );
  }
  private async revokeActiveRefreshTokens(userId: number): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
  private parseExpiryToMs(expiry: string): number {
    const match = expiry.match(/^(\d+)([smhd])$/);
    if (!match) {
      return 7 * 24 * 60 * 60 * 1000;
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

  // Audit logging must not block authentication flows.
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
        const message = getSafeErrorLogMessage(error);
        this.logger.error(`Failed to queue audit log: ${message}`);
      });
  }
}
