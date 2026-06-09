# SeaFishing 后端 API

NestJS + Prisma + MySQL，为海钓小程序提供登录、船只、预约订单等接口。

## 快速启动

### 1. 启动 MySQL

```bash
cd server
docker compose up -d
```

### 2. 配置环境变量

```bash
copy .env.example .env
```

默认连接：`mysql://seafishing:seafishing@127.0.0.1:3306/seafishing`

### 3. 安装依赖并初始化数据库

```bash
npm install
npx prisma migrate dev --name init
npm run db:seed
```

### 4. 启动 API

```bash
npm run start:dev
```

健康检查：<http://127.0.0.1:3000/api/health>

## 小程序联调

1. 确认 `miniprogram/config/api.js` 中：

   - `USE_API: true`
   - `BASE_URL: 'http://127.0.0.1:3000/api'`

2. 微信开发者工具 → 详情 → 本地设置 → 勾选 **不校验合法域名**

3. 启动后端后，在小程序中：
   - 登录 → 调用 `POST /api/auth/wx-login`
   - 约船页 → 调用 `GET /api/boats`
   - 下单 → 调用 `POST /api/bookings`

## 开发模式登录

未配置 `WX_APPID` / `WX_SECRET` 时，设置 `WX_DEV_MODE=true`，小程序 `wx.login` 的 code 会映射为测试 openid，便于本地联调。

生产环境请填写：

```env
WX_APPID=你的AppID
WX_SECRET=你的AppSecret
WX_DEV_MODE=false
JWT_SECRET=随机长字符串
```

## 管理后台

启动 API 后浏览器打开：

<http://127.0.0.1:3000/admin/index.html>

（管理页文件位于 `server/public/admin/index.html`，由后端静态托管）

默认账号（可在 `.env` 修改）：

- 用户名：`admin`
- 密码：`admin123`

功能：订单管理、船只列表、赛事报名名单。

## 已实现的 API

| 方法 | 路径 | 说明 | 鉴权 |
|------|------|------|------|
| GET | `/api/health` | 健康检查 | 否 |
| POST | `/api/auth/wx-login` | 微信登录 | 否 |
| GET | `/api/users/me` | 当前用户 | 是 |
| PATCH | `/api/users/me` | 更新资料 | 是 |
| PATCH | `/api/users/me/verify` | 实名认证 | 是 |
| GET | `/api/boats` | 船只列表 | 否 |
| GET | `/api/boats/:boatId` | 船只详情 | 否 |
| GET | `/api/bookings` | 我的订单 | 是 |
| POST | `/api/bookings` | 创建预约 | 是 |
| GET | `/api/competitions` | 赛事列表 | 否 |
| GET | `/api/competitions/:legacyId` | 赛事详情 | 否 |
| POST | `/api/competitions/:legacyId/register` | 赛事报名 | 是 |
| GET | `/api/spots` | 钓点列表 | 否 |
| GET | `/api/spots/:spotKey` | 钓点详情 | 否 |
| GET | `/api/favorites` | 我的收藏钓点 | 是 |
| POST | `/api/favorites/:spotKey` | 收藏钓点 | 是 |
| DELETE | `/api/favorites/:spotKey` | 取消收藏 | 是 |
| GET | `/api/banners` | 首页轮播 | 否 |
| POST | `/api/admin/auth/login` | 管理后台登录 | 否 |
| GET | `/api/admin/bookings` | 管理订单 | 管理员 |
| PATCH | `/api/admin/bookings/:id/status` | 改订单状态 | 管理员 |
| GET | `/api/admin/boats` | 管理船只 | 管理员 |
| GET | `/api/admin/competitions/:legacyId/registrations` | 报名名单 | 管理员 |

## 数据库表

- `users` 用户
- `boats` 船只
- `bookings` 预约订单
- `fishing_spots` / `spot_boat_links` 钓点（已 seed，API 待接）
- `competitions` / `competition_registrations` 赛事（已 seed，API 待接）
- `banners` 首页轮播（已 seed，API 待接）

## 上线 checklist

1. 购买云服务器 + 域名，完成 **ICP 备案**
2. 部署 MySQL + Node 服务，配置 **HTTPS**
3. 微信公众平台配置 **request 合法域名**
4. 填写 `WX_APPID` / `WX_SECRET`，关闭 `WX_DEV_MODE`
5. `auth.js` 中 `SKIP_ID_VERIFY = false`
6. 后续：管理后台、微信支付、赛事/钓点 API

## 项目结构

```
server/
├── prisma/schema.prisma   # 数据模型
├── prisma/seed.ts         # 初始数据
├── src/auth/              # 微信登录 + JWT
├── src/boats/             # 船只
├── src/bookings/          # 预约订单
├── src/users/             # 用户资料
└── docker-compose.yml     # 本地 MySQL
```
