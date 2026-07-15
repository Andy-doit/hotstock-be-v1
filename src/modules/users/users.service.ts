import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { UserResponseDto, PaginatedUsersDto } from './dto/user-response.dto';
import { UpdateUserDto } from './dto/update-user.dto';

/** User shape with plan included — used by mapToResponse. */
type UserWithPlan = Prisma.UserGetPayload<{ include: { plan: true } }>;

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─── ADMIN: FIND ALL ────────────────────────────────────────────────────────

  async findAll(query: {
    page: number;
    limit: number;
    role?: Role;
    blocked?: boolean;
    search?: string;
    sort?: string;
    order?: 'asc' | 'desc';
  }): Promise<PaginatedUsersDto> {
    const { page, limit, role, blocked, search, sort, order } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.UserWhereInput = {
      ...(role && { role }),
      ...(blocked !== undefined && { blocked }),
      ...(search && {
        OR: [
          { email: { contains: search, mode: 'insensitive' } },
          { username: { contains: search, mode: 'insensitive' } },
          { fullName: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    // Build orderBy — only allow safe columns
    const allowedSortFields = ['createdAt', 'email', 'username', 'role'] as const;
    type SortField = (typeof allowedSortFields)[number];
    const sortField: SortField = allowedSortFields.includes(sort as SortField)
      ? (sort as SortField)
      : 'createdAt';
    const sortOrder: 'asc' | 'desc' = order === 'asc' ? 'asc' : 'desc';

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortField]: sortOrder },
        include: { plan: true },
      }),
      this.prisma.user.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data: users.map(this.mapToResponse),
      total,
      page,
      limit,
      totalPages,
    };
  }

  // ─── ADMIN: FIND ONE ────────────────────────────────────────────────────────

  async findOne(id: number): Promise<UserResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { plan: true },
    });

    if (!user) {
      throw new NotFoundException('Không tìm thấy người dùng');
    }

    return this.mapToResponse(user);
  }

  // ─── ADMIN: UPDATE ROLE ────────────────────────────────────────────────────

  async updateRole(
    adminId: number,
    targetId: number,
    role: Role,
  ): Promise<UserResponseDto> {
    if (adminId === targetId) {
      throw new BadRequestException('Không thể thay đổi role của chính mình');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: targetId },
    });

    if (!user) {
      throw new NotFoundException('Không tìm thấy người dùng');
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: targetId },
      data: { role },
      include: { plan: true },
    });

    return this.mapToResponse(updatedUser);
  }

  // ─── ADMIN: BLOCK USER ──────────────────────────────────────────────────────

  async blockUser(adminId: number, targetId: number): Promise<void> {
    if (adminId === targetId) {
      throw new BadRequestException('Không thể tự khóa tài khoản của mình');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: targetId },
    });

    if (!user) {
      throw new NotFoundException('Không tìm thấy người dùng');
    }

    // Block user and delete all their refresh tokens to force logout
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: targetId },
        data: { blocked: true },
      }),
      this.prisma.refreshToken.deleteMany({
        where: { userId: targetId },
      }),
    ]);
  }

  // ─── ADMIN: UNBLOCK USER ────────────────────────────────────────────────────

  async unblockUser(targetId: number): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: targetId },
    });

    if (!user) {
      throw new NotFoundException('Không tìm thấy người dùng');
    }

    await this.prisma.user.update({
      where: { id: targetId },
      data: { blocked: false },
    });
  }

  // ─── ADMIN: ASSIGN PLAN ─────────────────────────────────────────────────────

  async assignPlan(
    targetId: number,
    planId: number,
  ): Promise<UserResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: targetId },
    });

    if (!user) {
      throw new NotFoundException('Không tìm thấy người dùng');
    }

    const plan = await this.prisma.plan.findUnique({
      where: { id: planId },
    });

    if (!plan) {
      throw new NotFoundException('Không tìm thấy gói');
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: targetId },
      data: { planId },
      include: { plan: true },
    });

    // Also delete refresh tokens so the user gets a new JWT with new planLevel
    await this.prisma.refreshToken.deleteMany({
      where: { userId: targetId },
    });

    return this.mapToResponse(updatedUser);
  }

  // ─── ADMIN: DELETE USER ──────────────────────────────────────────────────────

  async deleteUser(targetId: number): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: targetId },
    });

    if (!user) {
      throw new NotFoundException('Không tìm thấy người dùng');
    }

    // Delete all related data first, then delete the user
    await this.prisma.$transaction([
      this.prisma.refreshToken.deleteMany({
        where: { userId: targetId },
      }),
      this.prisma.auditLog.deleteMany({
        where: { userId: targetId },
      }),
      this.prisma.article.updateMany({
        where: { authorId: targetId },
        data: { authorId: null },
      }),
      this.prisma.user.delete({
        where: { id: targetId },
      }),
    ]);
  }

  // ─── ADMIN: UPDATE USER ─────────────────────────────────────────────────────

  async adminUpdateUser(
    targetId: number,
    dto: import('./dto/admin-update-user.dto').AdminUpdateUserDto,
  ): Promise<UserResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: targetId },
      include: { plan: true },
    });

    if (!user) {
      throw new NotFoundException('Không tìm thấy người dùng');
    }

    // Check email uniqueness if changing email
    if (dto.email && dto.email !== user.email) {
      const existing = await this.prisma.user.findUnique({
        where: { email: dto.email },
      });
      if (existing) {
        throw new ConflictException('Email đã được sử dụng');
      }
    }

    // Check username uniqueness if changing username
    if (dto.username && dto.username !== user.username) {
      const existing = await this.prisma.user.findFirst({
        where: { username: dto.username },
      });
      if (existing) {
        throw new ConflictException('Tên người dùng đã được sử dụng');
      }
    }

    const shouldRevokeSessions =
      (dto.role !== undefined && dto.role !== user.role) ||
      (dto.blocked !== undefined && dto.blocked !== user.blocked) ||
      (dto.confirmed !== undefined && dto.confirmed !== user.confirmed);

    const updatedUser = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id: targetId },
        data: {
          ...(dto.username !== undefined && { username: dto.username }),
          ...(dto.fullName !== undefined && { fullName: dto.fullName }),
          ...(dto.phoneNumber !== undefined && { phoneNumber: dto.phoneNumber }),
          ...(dto.email !== undefined && { email: dto.email }),
          ...(dto.role !== undefined && { role: dto.role }),
          ...(dto.blocked !== undefined && { blocked: dto.blocked }),
          ...(dto.confirmed !== undefined && { confirmed: dto.confirmed }),
        },
        include: { plan: true },
      });

      if (shouldRevokeSessions) {
        await tx.refreshToken.deleteMany({
          where: { userId: targetId },
        });
      }

      return updated;
    });

    return this.mapToResponse(updatedUser);
  }

  // ─── USER: GET PROFILE ──────────────────────────────────────────────────────

  async getProfile(userId: number): Promise<UserResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { plan: true },
    });

    if (!user) {
      throw new NotFoundException('Không tìm thấy người dùng');
    }

    return this.mapToResponse(user);
  }

  // ─── USER: UPDATE PROFILE ───────────────────────────────────────────────────

  async updateProfile(
    userId: number,
    dto: UpdateUserDto,
  ): Promise<UserResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('Không tìm thấy người dùng');
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.username && { username: dto.username }),
        ...(dto.fullName !== undefined && { fullName: dto.fullName }),
        ...(dto.phoneNumber !== undefined && { phoneNumber: dto.phoneNumber }),
      },
      include: { plan: true },
    });

    return this.mapToResponse(updatedUser);
  }

  // ─── HELPERS ────────────────────────────────────────────────────────────────

  /**
   * Helper to strip sensitive data (passwordHash) from user object
   * and shape the plan correctly.
   */
  private mapToResponse(user: UserWithPlan): UserResponseDto {
    return {
      id: user.id,
      email: user.email,
      username: user.username,
      fullName: user.fullName ?? null,
      phoneNumber: user.phoneNumber ?? null,
      role: user.role,
      provider: user.provider,
      confirmed: user.confirmed,
      blocked: user.blocked,
      termsAccepted: user.termsAccepted,
      termsAcceptedAt: user.termsAcceptedAt,
      personalDataConsent: user.personalDataConsent,
      personalDataConsentAt: user.personalDataConsentAt,
      passwordChangedAt: user.passwordChangedAt,
      plan: user.plan
        ? {
            id: user.plan.id,
            name: user.plan.name,
            slug: user.plan.slug,
            level: user.plan.level,
          }
        : null,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
