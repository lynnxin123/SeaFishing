import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
  ) {}

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('用户不存在');
    }
    return this.authService.toUserProfile(user);
  }

  async updateProfile(
    userId: string,
    data: { nickName?: string; avatarUrl?: string; phone?: string },
  ) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data,
    });
    return this.authService.toUserProfile(user);
  }

  async verifyIdentity(
    userId: string,
    data: { realName: string; idNumber: string; idType?: string },
  ) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        verified: true,
        realName: data.realName,
        idNumber: data.idNumber,
        idType: data.idType || '身份证',
      },
    });
    return this.authService.toUserProfile(user);
  }
}
