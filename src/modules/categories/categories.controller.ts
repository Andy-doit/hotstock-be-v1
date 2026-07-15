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
import { Category, Role } from '@prisma/client';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('Categories')
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  // ─── PUBLIC: list all categories ───────────────────────────────────────────

  @Get()
  @ApiOperation({
    summary: 'Danh sách danh mục',
    description: 'Trả về tất cả danh mục, sắp xếp theo tên',
  })
  @ApiResponse({ status: 200, description: 'Danh sách danh mục' })
  async findAll(): Promise<Category[]> {
    return this.categoriesService.findAll();
  }

  // ─── PUBLIC: get category by slug ──────────────────────────────────────────

  @Get(':slug')
  @ApiOperation({
    summary: 'Chi tiết danh mục',
    description: 'Trả về thông tin danh mục theo slug',
  })
  @ApiResponse({ status: 200, description: 'Thông tin danh mục' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy danh mục' })
  async findBySlug(@Param('slug') slug: string): Promise<Category> {
    return this.categoriesService.findBySlug(slug);
  }

  // ─── ADMIN/EDITOR: create category ────────────────────────────────────────

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.admin, Role.editor)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Tạo danh mục',
    description: 'Admin hoặc editor tạo danh mục mới. Slug tự tạo từ tên nếu bỏ trống.',
  })
  @ApiResponse({ status: 201, description: 'Danh mục đã được tạo' })
  @ApiResponse({ status: 401, description: 'Chưa đăng nhập' })
  @ApiResponse({ status: 403, description: 'Không có quyền' })
  @ApiResponse({ status: 409, description: 'Slug đã tồn tại' })
  async create(@Body() dto: CreateCategoryDto): Promise<Category> {
    return this.categoriesService.create(dto);
  }

  // ─── ADMIN/EDITOR: update category ────────────────────────────────────────

  @Patch(':slug')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.admin, Role.editor)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Cập nhật danh mục',
    description: 'Cập nhật tên và/hoặc slug danh mục',
  })
  @ApiResponse({ status: 200, description: 'Danh mục đã được cập nhật' })
  @ApiResponse({ status: 401, description: 'Chưa đăng nhập' })
  @ApiResponse({ status: 403, description: 'Không có quyền' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy danh mục' })
  @ApiResponse({ status: 409, description: 'Slug đã tồn tại' })
  async update(
    @Param('slug') slug: string,
    @Body() dto: UpdateCategoryDto,
  ): Promise<Category> {
    return this.categoriesService.update(slug, dto);
  }

  // ─── ADMIN ONLY: delete category ──────────────────────────────────────────

  @Delete(':slug')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.admin)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Xóa danh mục',
    description: 'Không thể xóa danh mục đang có bài viết. Chỉ admin.',
  })
  @ApiResponse({ status: 200, description: 'Danh mục đã được xóa' })
  @ApiResponse({ status: 400, description: 'Danh mục đang có bài viết' })
  @ApiResponse({ status: 401, description: 'Chưa đăng nhập' })
  @ApiResponse({ status: 403, description: 'Không có quyền' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy danh mục' })
  async remove(@Param('slug') slug: string): Promise<{ message: string }> {
    await this.categoriesService.remove(slug);
    return { message: 'Danh mục đã được xóa' };
  }
}
