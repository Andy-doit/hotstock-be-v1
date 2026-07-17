import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateTagDto } from './dto/create-tag.dto';
import { TagResponseDto } from './dto/tag-response.dto';
import { UpdateTagDto } from './dto/update-tag.dto';

type TagRecord = Prisma.TagGetPayload<Prisma.TagDefaultArgs>;
type TagWithCount = Prisma.TagGetPayload<{
  include: { _count: { select: { articles: true } } };
}>;
type TagMapperInput = TagRecord | TagWithCount;

const TAG_LIST_LIMIT = 500;

@Injectable()
export class TagsService {
  constructor(private prisma: PrismaService) {}

  async findAll(): Promise<TagResponseDto[]> {
    const tags = await this.prisma.tag.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: { articles: true },
        },
      },
      take: TAG_LIST_LIMIT,
    });

    return tags.map((tag) => this.mapTag(tag));
  }

  async create(dto: CreateTagDto): Promise<TagResponseDto> {
    if (dto.slug) {
      const existing = await this.prisma.tag.findUnique({
        where: { slug: dto.slug },
      });
      if (existing) {
        throw new ConflictException('Slug đã tồn tại');
      }
    }

    const tag = await this.prisma.tag.create({
      data: {
        name: dto.name,
        slug: dto.slug ?? this.generateSlug(dto.name),
      },
    });

    return this.mapTag(tag);
  }

  async update(slug: string, dto: UpdateTagDto): Promise<TagResponseDto> {
    const existing = await this.prisma.tag.findUnique({ where: { slug } });
    if (!existing) {
      throw new NotFoundException('Không tìm thấy thẻ');
    }

    if (dto.slug && dto.slug !== slug) {
      const slugTaken = await this.prisma.tag.findUnique({
        where: { slug: dto.slug },
      });
      if (slugTaken) {
        throw new ConflictException('Slug đã tồn tại');
      }
    }

    const tag = await this.prisma.tag.update({
      where: { slug },
      data: dto,
    });

    return this.mapTag(tag);
  }

  async remove(slug: string): Promise<TagResponseDto> {
    const existing = await this.prisma.tag.findUnique({ where: { slug } });
    if (!existing) {
      throw new NotFoundException('Không tìm thấy thẻ');
    }

    const tag = await this.prisma.tag.delete({
      where: { slug },
    });

    return this.mapTag(tag);
  }

  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '');
  }

  private mapTag(tag: TagMapperInput): TagResponseDto {
    return {
      id: tag.id,
      name: tag.name,
      slug: tag.slug,
      ...('_count' in tag ? { _count: { articles: tag._count.articles } } : {}),
    };
  }
}
