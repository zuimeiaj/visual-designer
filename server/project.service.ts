
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from './prisma.service'; // 假设已存在简单的 Prisma 封装
import { Prisma } from '@prisma/client';

@Injectable()
export class ProjectService {
  constructor(private prisma: PrismaService) {}

  async create(name: string, data: any) {
    return this.prisma.project.create({
      data: { name, data },
    });
  }

  async findAll() {
    return this.prisma.project.findMany({
      orderBy: { updatedAt: 'desc' },
      select: { id: true, name: true, updatedAt: true },
    });
  }

  async findOne(id: string) {
    const project = await this.prisma.project.findUnique({ where: { id } });
    if (!project) throw new NotFoundException('Project not found');
    return project;
  }

  async update(id: string, data: any) {
    return this.prisma.project.update({
      where: { id },
      data: { data },
    });
  }

  async remove(id: string) {
    return this.prisma.project.delete({ where: { id } });
  }
}
