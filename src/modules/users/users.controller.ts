import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  Req,
  UseGuards,
  ParseIntPipe,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { FastifyRequest } from 'fastify';

import { UsersService } from './users.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

import { UpdateUserDto } from './dto/update-user.dto';
import { AdminUpdateUserDto } from './dto/admin-update-user.dto';
import { UserListQueryDto } from './dto/user-query.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { AssignPlanDto } from './dto/assign-plan.dto';
import {
  UserResponseDto,
  PaginatedUsersDto,
} from './dto/user-response.dto';

@ApiTags('Users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.admin)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Xóa tài khoản (Admin)',
    description: 'Xóa vĩnh viễn một tài khoản người dùng.',
  })
  @ApiResponse({ status: 200, description: 'Tài khoản đã bị xóa' })
  async deleteUser(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<{ message: string }> {
    await this.usersService.deleteUser(id);
    return { message: 'Tài khoản đã bị xóa thành công' };
  }

  // ─── ADMIN: GET ALL USERS ─────────────────────────────────────────────────

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.admin)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Danh sách người dùng (Admin)',
    description: 'Lấy danh sách người dùng, phân trang và lọc.',
  })
  @ApiResponse({ status: 200, type: PaginatedUsersDto })
  async findAll(@Query() query: UserListQueryDto): Promise<PaginatedUsersDto> {
    const normalized: {
      page: number;
      limit: number;
      role?: Role;
      blocked?: boolean;
      search?: string;
      sort?: string;
      order?: 'asc' | 'desc';
    } = {
      page: query.page ?? 1,
      limit: query.limit ?? 20,
    };
    if (query.role !== undefined) normalized.role = query.role;
    if (query.blocked !== undefined) normalized.blocked = query.blocked;
    if (query.search !== undefined) normalized.search = query.search;
    if (query.sort !== undefined) normalized.sort = query.sort;
    if (query.order !== undefined) normalized.order = query.order;
    return this.usersService.findAll(normalized);
  }

  // ─── USER: GET OWN PROFILE ────────────────────────────────────────────────

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Lấy thông tin cá nhân',
    description: 'Lấy thông tin profile của user đang đăng nhập.',
  })
  @ApiResponse({ status: 200, type: UserResponseDto })
  async getProfile(@Req() req: FastifyRequest): Promise<UserResponseDto> {
    if (!req.user) {
      throw new UnauthorizedException('Authentication required');
    }
    return this.usersService.getProfile(req.user.sub);
  }

  // ─── USER: UPDATE OWN PROFILE ─────────────────────────────────────────────

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Cập nhật thông tin cá nhân',
    description: 'User tự cập nhật tên người dùng của mình.',
  })
  @ApiResponse({ status: 200, type: UserResponseDto })
  async updateProfile(
    @Req() req: FastifyRequest,
    @Body() dto: UpdateUserDto,
  ): Promise<UserResponseDto> {
    if (!req.user) {
      throw new UnauthorizedException('Authentication required');
    }
    return this.usersService.updateProfile(req.user.sub, dto);
  }

  // ─── ADMIN: GET USER BY ID ────────────────────────────────────────────────

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.admin)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Chi tiết người dùng (Admin)',
    description: 'Xem thông tin chi tiết một người dùng.',
  })
  @ApiResponse({ status: 200, type: UserResponseDto })
  async findOne(@Param('id', ParseIntPipe) id: number): Promise<UserResponseDto> {
    return this.usersService.findOne(id);
  }

  // ─── ADMIN: UPDATE USER PROFILE ──────────────────────────────────────────

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.admin)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Cập nhật thông tin người dùng (Admin)',
    description:
      'Admin cập nhật thông tin profile, email, role, trạng thái khóa/xác nhận của người dùng.',
  })
  @ApiResponse({ status: 200, type: UserResponseDto })
  async adminUpdateUser(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AdminUpdateUserDto,
  ): Promise<UserResponseDto> {
    return this.usersService.adminUpdateUser(id, dto);
  }

  // ─── ADMIN: UPDATE USER ROLE ──────────────────────────────────────────────

  @Patch(':id/role')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.admin)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Cập nhật phân quyền người dùng (Admin)',
    description: 'Thay đổi role của người dùng. Không thể tự đổi role chính mình.',
  })
  @ApiResponse({ status: 200, type: UserResponseDto })
  async updateRole(
    @Req() req: FastifyRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateRoleDto,
  ): Promise<UserResponseDto> {
    if (!req.user) {
      throw new UnauthorizedException('Authentication required');
    }
    return this.usersService.updateRole(req.user.sub, id, dto.role);
  }

  // ─── ADMIN: ASSIGN PLAN TO USER ───────────────────────────────────────────

  @Patch(':id/plan')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.admin)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Gán gói cho người dùng (Admin)',
    description: 'Chỉ định thủ công một gói trả phí cho người dùng.',
  })
  @ApiResponse({ status: 200, type: UserResponseDto })
  async assignPlan(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AssignPlanDto,
  ): Promise<UserResponseDto> {
    return this.usersService.assignPlan(id, dto.planId);
  }

  // ─── ADMIN: BLOCK USER ────────────────────────────────────────────────────

  @Patch(':id/block')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.admin)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Khóa tài khoản (Admin)',
    description: 'Khóa người dùng và buộc đăng xuất.',
  })
  @ApiResponse({ status: 200, description: 'Tài khoản đã bị khóa' })
  async blockUser(
    @Req() req: FastifyRequest,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<{ message: string }> {
    if (!req.user) {
      throw new UnauthorizedException('Authentication required');
    }
    await this.usersService.blockUser(req.user.sub, id);
    return { message: 'Tài khoản đã bị khóa thành công' };
  }

  // ─── ADMIN: UNBLOCK USER ──────────────────────────────────────────────────

  @Patch(':id/unblock')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.admin)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Mở khóa tài khoản (Admin)',
    description: 'Mở khóa cho người dùng đã bị khóa.',
  })
  @ApiResponse({ status: 200, description: 'Tài khoản đã được mở khóa' })
  async unblockUser(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<{ message: string }> {
    await this.usersService.unblockUser(id);
    return { message: 'Tài khoản đã được mở khóa thành công' };
  }
}
