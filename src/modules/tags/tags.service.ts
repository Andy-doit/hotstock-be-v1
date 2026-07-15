import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateTagDto } from './dto/create-tag.dto';
import { UpdateTagDto } from './dto/update-tag.dto';

@Injectable()
export class TagsService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.tag.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: { articles: true }
        }
      }
    });
  }

  async create(dto: CreateTagDto) {
    if (dto.slug) {
      const existing = await this.prisma.tag.findUnique({ where: { slug: dto.slug } });
      if (existing) throw new ConflictException('Slug đã tồn tại');
    }
    
    // Auto-generate slug if missing
    let slugToSave = dto.slug;
    if (!slugToSave) {
      slugToSave = dto.name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)+/g, '');
    }

    return this.prisma.tag.create({
      data: {
        name: dto.name,
        slug: slugToSave,
      },
    });
  }

  async update(slug: string, dto: UpdateTagDto) {
    const existing = await this.prisma.tag.findUnique({ where: { slug } });
    if (!existing) throw new NotFoundException('Không tìm thấy thẻ');

    if (dto.slug && dto.slug !== slug) {
      const slugTaken = await this.prisma.tag.findUnique({ where: { slug: dto.slug } });
      if (slugTaken) throw new ConflictException('Slug đã tồn tại');
    }

    return this.prisma.tag.update({
      where: { slug },
      data: dto,
    });
  }

  async remove(slug: string) {
    const existing = await this.prisma.tag.findUnique({ where: { slug } });
    if (!existing) throw new NotFoundException('Không tìm thấy thẻ');

    return this.prisma.tag.delete({
      where: { slug },
    });
  }
}
