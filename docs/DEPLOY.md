# 上线部署（Render 单服务）

目标：打开一个网址就能用，不再需要 `start.bat`。
方案：后端一个服务同时提供 API 和前端页面（`backend/app/main.py` 会在
`frontend/dist` 存在时自动托管它，同源，无跨域配置）。

> 注意（免费版限制）：Render 免费服务的磁盘是临时的，SQLite 数据和上传
> 的照片在服务重启/重新部署后会丢失。正式用请升级到带持久盘的方案
> （Postgres + 对象存储），数据模型层已做隔离，迁移成本小。

## 方式一：Render Blueprint（推荐，跟着点就行）

1. 把本仓库推到 GitHub（已在 `wdz316/fukuoka-walks`）。
2. 打开 https://dashboard.render.com/blueprints ，点 **New Blueprint Instance**，
   选择 `wdz316/fukuoka-walks` 仓库，Render 会自动读到根目录的 `render.yaml`。
3. 点 **Apply**，等构建完成（约 3–6 分钟：先 `npm ci && npm run build`
   打前端，再 `pip install` 装后端）。
4. 构建成功后打开分配的网址（如 `https://fukuoka-walks.onrender.com`）：
   - 首页能打开 = 前端托管成功
   - `https://<你的域名>/health` 返回 `{"status":"ok"}` = 后端正常
   - 在页面里搜一次福冈、有结果 = 数据库种子正常

本地已经验证过的等价行为（`backend/tests/test_frontend_hosting.py`）：
`/` 与 `/plan` 返回前端页面，`/assets/*` 返回静态文件，
`/api/*` 未知路径仍返回 404 JSON。

## 方式二：本地 Docker 验证

```powershell
docker build -t fukuoka-walks .
docker run --rm -p 8000:8000 fukuoka-walks
```

打开 http://localhost:8000 ，首页、`/plan`、`/health` 都应正常。

## 重要环境变量（Render 上一般不用动）

| 变量 | 默认 | 说明 |
|---|---|---|
| `PORT` | `8000` | Render 自动注入，Dockerfile 已适配 |
| `AI_PROVIDER` | `rule` | 推荐引擎，默认本地规则即可 |
| `DATABASE_URL` | `sqlite:///backend/data/app.db` | 免费版临时盘；要持久化请换 Postgres 并改此变量 |

## 回滚

Render 每次部署都保留历史版本，出问题在 Dashboard 点 **Rollback**
即可回到上一个能用的版本。
