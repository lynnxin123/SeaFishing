import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { isTestOpenid, validateContact } from '../common/contact.util';

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
    return this.toPublicProfile(user);
  }

  async updateProfile(
    userId: string,
    data: { nickName?: string; avatarUrl?: string; phone?: string; wechatId?: string },
  ) {
    const current = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!current) {
      throw new NotFoundException('用户不存在');
    }

    const nextPhone = data.phone !== undefined ? data.phone : current.phone;
    const nextWechat =
      data.wechatId !== undefined ? data.wechatId : current.wechatId;

    if (data.phone !== undefined || data.wechatId !== undefined) {
      const check = validateContact(nextPhone, nextWechat, isTestOpenid(current.openid));
      if (!check.ok) {
        throw new BadRequestException(check.reason || '联系方式无效');
      }
    }

    const user = await this.prisma.user.update({
      where: { id: userId },
      data,
    });
    return this.toPublicProfile(user);
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
    return this.toPublicProfile(user);
  }

  private toPublicProfile(user: {
    nickName: string;
    avatarUrl: string;
    phone: string;
    wechatId: string;
    openid: string;
    verified: boolean;
    realName: string;
    levelName: string;
    medals: number;
    points: number;
    fishFood: number;
  }) {
    return {
      ...this.authService.toUserProfile(user),
      isTestAccount: isTestOpenid(user.openid),
    };
  }
}
