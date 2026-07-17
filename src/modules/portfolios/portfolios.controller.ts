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
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { PortfoliosService } from './portfolios.service';
import { CreatePortfolioDto } from './dto/create-portfolio.dto';
import { PortfolioResponseDto } from './dto/portfolio-response.dto';
import { UpdatePortfolioDto } from './dto/update-portfolio.dto';
import { PortfolioQueryDto } from './dto/portfolio-query.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../../common/guards/optional-jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { CommandMessageResponseDto } from '../../common/dto/command-response.dto';

type PortfolioRequest = {
  user?: Pick<JwtPayload, 'role' | 'planLevel'>;
};

@ApiTags('Portfolios')
@Controller('portfolios')
export class PortfoliosController {
  constructor(private readonly portfoliosService: PortfoliosService) {}

  @Get('all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.admin)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Lấy tất cả danh mục đầu tư (Admin)',
    description: 'Trả về tất cả danh mục đầu tư để quản lý trong Admin.',
  })
  async findAll(): Promise<PortfolioResponseDto[]> {
    return this.portfoliosService.findAll();
  }

  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({
    summary: 'Danh mục đầu tư mới nhất',
    description:
      'Trả về danh mục đầu tư mới nhất theo gói. Yêu cầu gói phù hợp.',
  })
  @ApiQuery({
    name: 'plan',
    required: true,
    description: 'Slug gói (vd: gold)',
  })
  @ApiResponse({ status: 200, description: 'Danh mục đầu tư' })
  @ApiResponse({ status: 403, description: 'Cần nâng cấp gói' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy gói hoặc danh mục' })
  async findLatestByPlan(
    @Query() query: PortfolioQueryDto,
    @Req() request: PortfolioRequest,
  ): Promise<PortfolioResponseDto> {
    const planLevel = request.user?.planLevel ?? 0;
    const userRole = request.user?.role;
    const bypassPlanCheck = userRole === 'admin' || userRole === 'editor';
    return this.portfoliosService.findLatestByPlan(
      query.plan,
      planLevel,
      bypassPlanCheck,
    );
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.admin)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Tạo danh mục đầu tư',
    description:
      'Tạo danh mục đầu tư mới với cổ phiếu, thông tin, lý do, và tín hiệu',
  })
  @ApiResponse({ status: 201, description: 'Danh mục đầu tư đã được tạo' })
  @ApiResponse({ status: 401, description: 'Chưa đăng nhập' })
  @ApiResponse({ status: 403, description: 'Không có quyền' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy gói' })
  async create(@Body() dto: CreatePortfolioDto): Promise<PortfolioResponseDto> {
    return this.portfoliosService.create(dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.admin)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Cập nhật danh mục đầu tư',
    description: 'Cập nhật danh mục. Dữ liệu lồng nhau sẽ được xóa và tạo lại.',
  })
  @ApiResponse({ status: 200, description: 'Danh mục đầu tư đã được cập nhật' })
  @ApiResponse({ status: 401, description: 'Chưa đăng nhập' })
  @ApiResponse({ status: 403, description: 'Không có quyền' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy danh mục đầu tư' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePortfolioDto,
  ): Promise<PortfolioResponseDto> {
    return this.portfoliosService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.admin)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Xóa danh mục đầu tư',
    description: 'Xóa danh mục đầu tư và tất cả dữ liệu liên quan. Chỉ admin.',
  })
  @ApiResponse({
    status: 200,
    description: 'Danh mục đầu tư đã được xóa',
    type: CommandMessageResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Chưa đăng nhập' })
  @ApiResponse({ status: 403, description: 'Không có quyền' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy danh mục đầu tư' })
  async remove(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<CommandMessageResponseDto> {
    await this.portfoliosService.remove(id);
    return { message: 'Danh mục đầu tư đã được xóa' };
  }
}
