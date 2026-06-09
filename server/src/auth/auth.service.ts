import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { WxLoginDto } from './dto/wx-login.dto';

interface WxSession {
  openid: string;
  session_key?: string;
  unionid?: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  async wxLogin(dto: WxLoginDto) {
    const session = await this.resolveWxSession(dto.code);
    const user = await this.prisma.user.upsert({
      where: { openid: session.openid },
      update: {
        nickName: dto.nickName || undefined,
        avatarUrl: dto.avatarUrl || undefined,
      },
      create: {
        openid: session.openid,
        nickName: dto.nickName || '微信用户',
        avatarUrl: dto.avatarUrl || '',
      },
    });

    const token = await this.jwtService.signAsync({
      sub: user.id,
      openid: user.openid,
    });

    return {
      token,
      user: this.toUserProfile(user),
    };
  }

  private async resolveWxSession(code: string): Promise<WxSession> {
    const devMode = this.config.get<string>('WX_DEV_MODE') !== 'false';
    const appId = (this.config.get<string>('WX_APPID') || '').trim();
    const secret = (this.config.get<string>('WX_SECRET') || '').trim();

    // 开发模式且未完整配置微信密钥：走本地 openid，不请求微信服务器
    if (devMode && (!appId || !secret)) {
      const openid = code.startsWith('dev:')
        ? code.slice(4)
        : `dev_${code || 'local'}`;
      return { openid };
    }

    if (!appId || !secret) {
      throw new UnauthorizedException(
        '未配置 WX_APPID / WX_SECRET，请在 server/.env 设置或开启 WX_DEV_MODE=true',
      );
    }

    const url =
      'https://api.weixin.qq.com/sns/jscode2session' +
      `?appid=${encodeURIComponent(appId)}` +
      `&secret=${encodeURIComponent(secret)}` +
      `&js_code=${encodeURIComponent(code)}` +
      '&grant_type=authorization_code';

    const res = await fetch(url);
    const data = (await res.json()) as WxSession & { errcode?: number; errmsg?: string };

    if (!data.openid) {
      throw new UnauthorizedException(data.errmsg || '微信登录失败');
    }

    return data;
  }

  toUserProfile(user: {
    nickName: string;
    avatarUrl: string;
    phone: string;
    verified: boolean;
    realName: string;
    levelName: string;
    medals: number;
    points: number;
    fishFood: number;
  }) {
    return {
      nickName: user.nickName,
      avatarUrl: user.avatarUrl,
      phone: user.phone,
      verified: user.verified,
      realName: user.realName,
      levelName: user.levelName,
      medals: user.medals,
      points: user.points,
      fishFood: user.fishFood,
    };
  }
}
