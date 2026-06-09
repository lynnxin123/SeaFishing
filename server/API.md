# SeaFishing API 文档

**Base URL：** `http://127.0.0.1:3000/api`  
**Content-Type：** `application/json`

---

## 通用说明

### 鉴权

| 类型 | Header |
|------|--------|
| 小程序用户 | `Authorization: Bearer <用户JWT>` |
| 管理后台 | `Authorization: Bearer <管理员JWT>` |

无需登录的接口标注为 **公开**。

### 成功响应

HTTP 状态码 `200/201`，响应体为 JSON（NestJS 直接返回业务对象，无额外 `code` 包装）。

### 错误响应

```json
{
  "statusCode": 400,
  "message": "错误说明，或校验失败字段数组",
  "error": "Bad Request"
}
```

常见状态码：`400` 参数错误、`401` 未登录/Token 失效、`404` 资源不存在。

---

## 1. 健康检查

### `GET /health` · 公开

**请求参数：** 无

**响应示例：**

```json
{
  "ok": true,
  "service": "seafishing-api"
}
```

---

## 2. 登录

### `POST /auth/wx-login` · 公开

微信小程序登录，开发模式下 `code` 可为任意字符串（如 `dev:local`）。

**请求 Body：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| code | string | 是 | `wx.login()` 返回的 code |
| nickName | string | 否 | 用户昵称 |
| avatarUrl | string | 否 | 头像 URL |

**请求示例：**

```json
{
  "code": "dev:local",
  "nickName": "微信用户",
  "avatarUrl": ""
}
```

**响应示例：**

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "nickName": "微信用户",
    "avatarUrl": "",
    "phone": "",
    "verified": false,
    "realName": "",
    "levelName": "青铜钓手",
    "medals": 0,
    "points": 0,
    "fishFood": 5
  }
}
```

---

## 3. 用户

> 以下接口均需 **用户 JWT**

### `GET /users/me`

获取当前用户资料。

**响应：** 同登录返回的 `user` 对象。

---

### `PATCH /users/me`

更新用户资料。

**请求 Body（均可选）：**

| 字段 | 类型 | 说明 |
|------|------|------|
| nickName | string | 昵称 |
| avatarUrl | string | 头像 |
| phone | string | 手机号 |

**响应：** 更新后的 `user` 对象。

---

### `PATCH /users/me/verify`

实名认证。

**请求 Body：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| realName | string | 是 | 真实姓名 |
| idNumber | string | 是 | 证件号 |
| idType | string | 否 | 默认 `身份证` |

**响应示例：**

```json
{
  "nickName": "微信用户",
  "avatarUrl": "",
  "phone": "",
  "verified": true,
  "realName": "张三",
  "levelName": "青铜钓手",
  "medals": 0,
  "points": 0,
  "fishFood": 5
}
```

---

## 4. 船只

### `GET /boats` · 公开

船只列表（分页）。

**Query 参数（均可选）：**

| 字段 | 类型 | 默认 | 说明 |
|------|------|------|------|
| wharf | string | — | 码头筛选，如 `大连码头` |
| keyword | string | — | 船名/船长/boatId 模糊搜索 |
| sort | string | comprehensive | `comprehensive` / `priceAsc` / `priceDesc` |
| page | number | 1 | 页码 |
| pageSize | number | 50 | 每页条数，最大 100 |

**响应示例：**

```json
{
  "total": 4,
  "page": 1,
  "pageSize": 50,
  "items": [
    {
      "id": "clxxx...",
      "shipName": "蓝海号渔船",
      "boatId": "LANHAI001",
      "maxNum": 10,
      "shipLen": 9.2,
      "shipWid": 2.8,
      "score": 4.9,
      "sailCount": 12,
      "experience": 8,
      "captain": "大海",
      "captainName": "大海",
      "captainAvatar": "/images/captain.jpg",
      "price": 1280,
      "images": ["/images/Reservation3.jpg"],
      "coverImage": "/images/Reservation3.jpg",
      "wharf": "大连码头",
      "displayWharf": "大连码头",
      "departWharf": "大连码头",
      "facilities": ["卫生间", "休息室"],
      "description": "...",
      "contact": "",
      "builtYear": 2018
    }
  ]
}
```

---

### `GET /boats/:boatId` · 公开

单船详情。`:boatId` 可为业务编号（如 `LANHAI001`）或数据库 id。

**响应：** 与列表中 `items[0]` 结构相同。

---

## 5. 预约订单

> 以下接口均需 **用户 JWT**

### `GET /bookings`

我的预约订单。

**Query 参数：**

| 字段 | 类型 | 说明 |
|------|------|------|
| status | string | 可选。`pending_pay` / `pending_accept` / `accepted` / `departed` / `completed` / `cancelled` |

**响应示例：**

```json
[
  {
    "id": "clxxx...",
    "orderNo": "HD1717841234567890",
    "shipName": "蓝海号渔船",
    "boatId": "clboat...",
    "coverImage": "/images/Reservation3.jpg",
    "price": "1280",
    "wharf": "大连码头",
    "departWharf": "大连码头",
    "date": "2026-06-10",
    "people": "2",
    "captainName": "大海",
    "status": "pending_accept",
    "statusLabel": "待接单",
    "createdAt": 1717841234567
  }
]
```

---

### `POST /bookings`

创建预约。

**请求 Body：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| shipName | string | 是 | 船名 |
| date | string | 是 | 预约日期，如 `2026-06-10` |
| people | number | 是 | 人数，≥1 |
| boatId | string | 否 | 船只编号 |
| coverImage | string | 否 | 封面图 |
| price | string | 否 | 价格 |
| wharf | string | 否 | 码头 |
| departWharf | string | 否 | 出发码头 |
| captainName | string | 否 | 船长 |
| status | string | 否 | `pending_pay` 或 `pending_accept`，默认后者 |

**响应：** 单条订单对象（同列表项）。

---

## 6. 赛事

### `GET /competitions` · 公开

赛事列表。

**响应示例：**

```json
[
  {
    "id": "1",
    "enLabel": "COMPETITION FOR SEA",
    "name": "春季海钓公开赛",
    "cover": "/images/competition1.jpg",
    "status": "registering",
    "statusText": "报名中",
    "location": "大连海域",
    "time": "2026.05.01 - 05.03",
    "fee": "500元/人",
    "summary": "...",
    "intro": "...",
    "rules": ["规则1", "规则2"],
    "prizes": "...",
    "organizer": "海发海岛海钓"
  }
]
```

> `id` 为 legacyId 字符串，报名/详情 URL 使用此 id。

---

### `GET /competitions/:legacyId` · 公开

单场赛事详情。`:legacyId` 为数字，如 `2`。

**响应：** 与列表单项结构相同。

---

### `GET /competitions/my/registrations` · 需用户 JWT

我的赛事报名记录。

**响应示例：**

```json
[
  {
    "id": "clreg...",
    "realName": "心心",
    "phone": "13899976543",
    "people": 1,
    "emergencyContact": "",
    "remark": "",
    "createdAt": 1717841880000,
    "competitionId": "2",
    "competitionName": "金秋海钓赛",
    "competitionCover": "/images/competition2.jpg",
    "competitionLocation": "大连海域",
    "competitionTime": "2026.09.18 - 09.20",
    "statusText": "报名中"
  }
]
```

---

### `POST /competitions/:legacyId/register` · 需用户 JWT

提交赛事报名。

**请求 Body：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| realName | string | 是 | 报名人姓名 |
| phone | string | 是 | 手机号，≥11 位 |
| people | number | 是 | 人数，≥1 |
| emergencyContact | string | 否 | 紧急联系人 |
| remark | string | 否 | 备注 |

**成功响应：** 数据库原始报名记录（含 `id`、`competitionId`、`userId`、`createdAt` 等）。

**常见错误：**

- `400` 您已报名该赛事
- `400` 该赛事已结束
- `404` 赛事不存在

---

## 7. 钓点

### `GET /spots` · 公开

钓点列表。

**响应示例：**

```json
[
  {
    "id": "dalian-bay-1",
    "name": "大连湾钓点",
    "type": "shore",
    "latitude": 38.914,
    "longitude": 121.614,
    "depth": "5-15m",
    "fishSpecies": ["黄鱼", "黑鲪"],
    "bestMonths": "5-10月",
    "chargeType": "paid",
    "priceNote": "200元/天",
    "seaRange": "near",
    "windSensitive": false,
    "eventId": null,
    "eventTitle": "",
    "ships": ["blue-sea"],
    "resolvedShips": [
      {
        "shipKey": "LANHAI001",
        "shipName": "蓝海号渔船",
        "boatId": "LANHAI001",
        "maxNum": 10,
        "price": 1280,
        "captain": "大海",
        "wharf": "大连码头",
        "facilities": ["卫生间"]
      }
    ]
  }
]
```

---

### `GET /spots/:spotKey` · 公开

单个钓点详情。`:spotKey` 如 `dalian-bay-1`。

**响应：** 与列表单项结构相同。

---

## 8. 收藏钓点

> 以下接口均需 **用户 JWT**

### `GET /favorites`

收藏的钓点列表（结构与 `/spots` 单项相同）。

---

### `POST /favorites/:spotKey`

添加收藏。

**响应示例：**

```json
{
  "favorited": true,
  "spotKey": "dalian-bay-1"
}
```

---

### `DELETE /favorites/:spotKey`

取消收藏。

**响应示例：**

```json
{
  "favorited": false,
  "spotKey": "dalian-bay-1"
}
```

---

## 9. Banner

### `GET /banners` · 公开

首页轮播图。

**响应示例：**

```json
[
  {
    "url": "/images/banner-1.jpg",
    "title": "海发船业",
    "subtitle": "深海出航，专业钓鱼服务"
  }
]
```

---

## 10. 管理后台

> 除登录外，均需 **管理员 JWT**（`role: admin`）

默认账号见 `server/.env`：`ADMIN_USERNAME` / `ADMIN_PASSWORD`（默认 `admin` / `admin123`）。

---

### `POST /admin/auth/login` · 公开

**请求 Body：**

| 字段 | 类型 | 必填 |
|------|------|------|
| username | string | 是 |
| password | string | 是 |

**响应示例：**

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "username": "admin"
}
```

---

### `GET /admin/bookings`

全部预约订单。

**Query：** `status`（可选，同用户订单状态枚举）

**响应：** 订单数组（含关联 `user`：`nickName`、`phone`、`realName`）。

---

### `PATCH /admin/bookings/:id/status`

修改订单状态。

**请求 Body：**

```json
{
  "status": "accepted"
}
```

可选值：`pending_pay` | `pending_accept` | `accepted` | `departed` | `completed` | `cancelled`

**响应：** 更新后的订单完整记录。

---

### `GET /admin/boats`

全部船只（含未上架 `active: false`）。

---

### `POST /admin/boats`

新增船只。

**请求 Body：**

| 字段 | 类型 | 必填 |
|------|------|------|
| boatId | string | 是 |
| shipName | string | 是 |
| maxNum | number | 否 |
| price | number | 否 |
| wharf | string | 否 |
| captain | string | 否 |
| score | number | 否 |
| images | string[] | 否 |
| facilities | string[] | 否 |

---

### `PATCH /admin/boats/:boatId`

更新船只。Body 同 POST，另可传 `active: boolean`。

---

### `GET /admin/competitions`

赛事列表（含 `_count.registrations` 报名人数）。

---

### `GET /admin/competitions/:legacyId/registrations`

某赛事报名名单。

**响应示例：**

```json
[
  {
    "id": "clreg...",
    "competitionId": "clcomp...",
    "userId": "cluser...",
    "realName": "心心",
    "phone": "13899976543",
    "people": 1,
    "emergencyContact": "",
    "remark": "",
    "createdAt": "2026-06-08T07:58:00.000Z",
    "user": {
      "nickName": "微信用户",
      "phone": ""
    }
  }
]
```

---

## 快速测试（curl）

```bash
# 健康检查
curl http://127.0.0.1:3000/api/health

# 开发模式登录
curl -X POST http://127.0.0.1:3000/api/auth/wx-login \
  -H "Content-Type: application/json" \
  -d "{\"code\":\"dev:test\",\"nickName\":\"测试用户\"}"

# 赛事列表
curl http://127.0.0.1:3000/api/competitions

# 管理员登录
curl -X POST http://127.0.0.1:3000/api/admin/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"admin\",\"password\":\"admin123\"}"
```

将返回的 `token` 填入：`Authorization: Bearer <token>`
