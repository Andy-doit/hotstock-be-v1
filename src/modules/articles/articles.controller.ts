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
  UnauthorizedException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { Role } from '@prisma/client';
import { FastifyRequest } from 'fastify';
import { ArticlesService } from './articles.service';
import { CreateArticleDto } from './dto/create-article.dto';
import { UpdateArticleDto } from './dto/update-article.dto';
import { ArticleListQueryDto } from './dto/article-list-query.dto';
import { PaginatedArticlesResponse } from './dto/article-response.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../../common/guards/optional-jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CommandMessageResponseDto } from '../../common/dto/command-response.dto';

@ApiTags('Articles')
@Controller('articles')
export class ArticlesController {
  constructor(private readonly articlesService: ArticlesService) {}

  @Get()
  @SkipThrottle()
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({
    summary: 'Danh sách bài viết',
    description:
      'Danh sách bài viết đã xuất bản, phân trang cursor, lọc theo danh mục',
  })
  @ApiQuery({ name: 'category', required: false, description: 'Slug danh mục' })
  @ApiQuery({
    name: 'cursor',
    required: false,
    description: 'ID bài viết cuối',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Số bài/trang (1-50)',
  })
  @ApiResponse({ status: 200, description: 'Danh sách bài viết phân trang' })
  async findAll(
    @Query() query: ArticleListQueryDto,
  ): Promise<PaginatedArticlesResponse> {
    return this.articlesService.findAll(query);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.admin, Role.editor, Role.user)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Danh sách bài viết của tôi',
    description: 'Lấy danh sách các bài viết do chính user hiện tại tạo.',
  })
  @ApiResponse({ status: 200, description: 'Danh sách bài viết phân trang' })
  @ApiResponse({ status: 401, description: 'Chưa đăng nhập' })
  async findOwn(
    @Query() query: ArticleListQueryDto,
    @Req() request: FastifyRequest,
  ): Promise<PaginatedArticlesResponse> {
    if (!request.user) {
      throw new UnauthorizedException('Authentication required');
    }
    return this.articlesService.findAllOwn(request.user.sub, query);
  }

  @Get('admin/list')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.admin, Role.editor)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Danh sách bài viết (Admin)',
    description:
      'Danh sách tất cả bài viết bao gồm bản nháp, phân trang cursor',
  })
  @ApiResponse({ status: 200, description: 'Danh sách bài viết phân trang' })
  async findAllAdmin(
    @Query() query: ArticleListQueryDto,
  ): Promise<PaginatedArticlesResponse> {
    return this.articlesService.findAllAdmin(query);
  }

  @Get('admin/:slug')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.admin, Role.editor)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Chi tiết bài viết (Admin)',
    description: 'Trả về bài viết đầy đủ bao gồm bản nháp cho admin/editor',
  })
  @ApiResponse({ status: 200, description: 'Chi tiết bài viết' })
  @ApiResponse({ status: 401, description: 'Chưa đăng nhập' })
  @ApiResponse({ status: 403, description: 'Không có quyền' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy bài viết' })
  async findBySlugAdmin(@Param('slug') slug: string) {
    return this.articlesService.findBySlugAdmin(slug);
  }

  @Get(':slug')
  @SkipThrottle()
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({
    summary: 'Chi tiết bài viết',
    description:
      'Trả về bài viết đầy đủ. Nội dung premium yêu cầu gói phù hợp.',
  })
  @ApiResponse({ status: 200, description: 'Chi tiết bài viết' })
  @ApiResponse({ status: 403, description: 'Cần nâng cấp gói' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy bài viết' })
  async findBySlug(
    @Param('slug') slug: string,
    @Req() request: FastifyRequest,
  ) {
    // request.user is typed via Fastify augmentation (see common/types/fastify.d.ts)
    const planLevel = request.user?.planLevel ?? 0;
    const userRole = request.user?.role;
    const bypassPlanCheck = userRole === 'admin' || userRole === 'editor';
    return this.articlesService.findBySlug(slug, planLevel, bypassPlanCheck);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.admin, Role.editor)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Tạo bài viết',
    description: 'Admin hoặc editor tạo bài viết mới',
  })
  @ApiResponse({ status: 201, description: 'Bài viết đã được tạo' })
  @ApiResponse({ status: 401, description: 'Chưa đăng nhập' })
  @ApiResponse({ status: 403, description: 'Không có quyền' })
  @ApiResponse({ status: 409, description: 'Slug đã tồn tại' })
  async create(@Body() dto: CreateArticleDto, @Req() request: FastifyRequest) {
    // JwtAuthGuard guarantees request.user is set
    if (!request.user) {
      throw new UnauthorizedException('Authentication required');
    }
    return this.articlesService.create(
      dto,
      request.user.sub,
      request.user.role,
    );
  }

  @Patch(':slug')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.admin, Role.editor)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Cập nhật bài viết',
    description: 'Cập nhật nội dung, metadata, hoặc phân quyền gói',
  })
  @ApiResponse({ status: 200, description: 'Bài viết đã được cập nhật' })
  @ApiResponse({ status: 401, description: 'Chưa đăng nhập' })
  @ApiResponse({ status: 403, description: 'Không có quyền' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy bài viết' })
  @ApiResponse({ status: 409, description: 'Slug đã tồn tại' })
  async update(
    @Param('slug') slug: string,
    @Body() dto: UpdateArticleDto,
    @Req() request: FastifyRequest,
  ) {
    if (!request.user) {
      throw new UnauthorizedException('Authentication required');
    }
    return this.articlesService.update(slug, dto, request.user.role);
  }

  @Delete(':slug')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.admin, Role.editor)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Xóa bài viết',
    description: 'Xóa vĩnh viễn bài viết. Admin hoặc tác giả của bài viết.',
  })
  @ApiResponse({
    status: 200,
    description: 'Bài viết đã được xóa',
    type: CommandMessageResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Chưa đăng nhập' })
  @ApiResponse({ status: 403, description: 'Không có quyền' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy bài viết' })
  async remove(
    @Param('slug') slug: string,
    @Req() request: FastifyRequest,
  ): Promise<CommandMessageResponseDto> {
    if (!request.user) {
      throw new UnauthorizedException('Authentication required');
    }
    await this.articlesService.remove(
      slug,
      request.user.sub,
      request.user.role,
    );
    return { message: 'Bài viết đã được xóa' };
  }
}
