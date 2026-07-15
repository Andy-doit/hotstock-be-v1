import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { Plan, Role } from '@prisma/client';
import { PlansService } from './plans.service';
import { CreatePlanDto } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';
import {
  CreatePlanFieldVisibilityDto,
  UpdatePlanFieldVisibilityDto,
} from './dto/plan-field-visibility.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('Plans')
@Controller('plans')
export class PlansController {
  constructor(private readonly plansService: PlansService) {}

  // ─── PUBLIC: list active plans ─────────────────────────────────────────────

  @Get()
  @SkipThrottle()
  @ApiOperation({
    summary: 'Danh sách gói (public)',
    description: 'Trả về tất cả gói đang hoạt động, sắp xếp theo sortOrder',
  })
  @ApiResponse({ status: 200, description: 'Danh sách gói' })
  async findAll(): Promise<Plan[]> {
    return this.plansService.findAll();
  }

  // ─── ADMIN: list all plans including inactive ─────────────────────────────

  @Get('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.admin)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Danh sách gói (admin)',
    description: 'Trả về tất cả gói bao gồm gói không hoạt động',
  })
  @ApiResponse({ status: 200, description: 'Danh sách tất cả gói' })
  @ApiResponse({ status: 401, description: 'Chưa đăng nhập' })
  @ApiResponse({ status: 403, description: 'Không có quyền' })
  async findAllAdmin(): Promise<Plan[]> {
    return this.plansService.findAllAdmin();
  }

  // ─── PUBLIC: get plan by slug ──────────────────────────────────────────────

  @Get(':slug')
  @ApiOperation({
    summary: 'Chi tiết gói',
    description: 'Trả về thông tin chi tiết một gói theo slug',
  })
  @ApiResponse({ status: 200, description: 'Thông tin gói' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy gói' })
  async findBySlug(@Param('slug') slug: string): Promise<Plan> {
    return this.plansService.findBySlug(slug);
  }

  // ─── ADMIN: create plan ────────────────────────────────────────────────────

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.admin)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Tạo gói mới',
    description: 'Chỉ admin được tạo gói',
  })
  @ApiResponse({ status: 201, description: 'Gói đã được tạo' })
  @ApiResponse({ status: 401, description: 'Chưa đăng nhập' })
  @ApiResponse({ status: 403, description: 'Không có quyền' })
  @ApiResponse({ status: 409, description: 'Slug đã tồn tại' })
  async create(@Body() dto: CreatePlanDto): Promise<Plan> {
    return this.plansService.create(dto);
  }

  // ─── ADMIN: update plan ────────────────────────────────────────────────────

  @Patch(':slug')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.admin)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Cập nhật gói',
    description: 'Cập nhật thông tin gói (slug và level không thể thay đổi)',
  })
  @ApiResponse({ status: 200, description: 'Gói đã được cập nhật' })
  @ApiResponse({ status: 401, description: 'Chưa đăng nhập' })
  @ApiResponse({ status: 403, description: 'Không có quyền' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy gói' })
  async update(
    @Param('slug') slug: string,
    @Body() dto: UpdatePlanDto,
  ): Promise<Plan> {
    return this.plansService.update(slug, dto);
  }

  @Patch(':slug/field-visibility')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.admin)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Cập nhật quyền xem dữ liệu theo plan',
    description:
      'Thiết lập plan được phép xem section nào trong dashboard/danh mục premium',
  })
  @ApiResponse({ status: 200, description: 'Đã cập nhật quyền hiển thị' })
  @ApiResponse({ status: 401, description: 'Chưa đăng nhập' })
  @ApiResponse({ status: 403, description: 'Không có quyền' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy gói' })
  async upsertFieldVisibility(
    @Param('slug') slug: string,
    @Body()
    dto: CreatePlanFieldVisibilityDto | UpdatePlanFieldVisibilityDto,
  ) {
    return this.plansService.upsertFieldVisibility(slug, dto);
  }

  // ─── ADMIN: delete plan ────────────────────────────────────────────────────

  @Delete(':slug')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.admin)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Xóa gói',
    description: 'Không thể xóa gói đang có người dùng sử dụng',
  })
  @ApiResponse({ status: 200, description: 'Gói đã được xóa' })
  @ApiResponse({ status: 400, description: 'Gói đang có người dùng sử dụng' })
  @ApiResponse({ status: 401, description: 'Chưa đăng nhập' })
  @ApiResponse({ status: 403, description: 'Không có quyền' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy gói' })
  async remove(@Param('slug') slug: string): Promise<{ message: string }> {
    await this.plansService.remove(slug);
    return { message: 'Gói đã được xóa' };
  }
}
