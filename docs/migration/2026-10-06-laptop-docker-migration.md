# 正式站点复制到 Linux 笔记本：Docker 迁移记录

日期：2026-10-06。用户批准迁移，要求镜像私有。网站已通过 HTTPS 隧道切到笔记本；旧服务器入口临时转发到笔记本。

## 16:59 后的独立只读复核与生产索引

当前生产主机为 `rong-ubuntu`，登录用户 `rong`，连接命令 `ssh rong-frp`。生产目录为 `/opt/mapflow-laptop-migration-20261006`，主机上的详细运维文档是 `/opt/mapflow-laptop-migration-20261006/OPERATIONS.md`。项目 `HANDOVER.md` 与 LLM Wiki 的 MapFlow 部署索引已更新到此入口；阿里云路径保留为历史迁移与回退资料。

- 使用 `sudo docker -H unix:///var/run/docker.sock` 核实系统 Docker。默认用户 Docker context 未显示容器，不能据此判断生产未启动。本部署没有 Compose 项目，不能以 `docker compose ls` 为空判断失败。
- `mapflow-laptop-app`、`mapflow-laptop-caddy` 均运行中；`mapflow-laptop-postgres` 运行且 healthy。镜像、映射端口与下表一致，restart policy 均为 `unless-stopped`。Docker 服务 enabled。
- 本地保留域名与证书校验的 HTTPS `/health/ready` 返回 200，公网 `https://xxian.fun/` 与 `/health/ready` 返回 200。未登录 `/api/auth/session` 返回 401。
- FRP 用户服务与防休眠服务 active，网站 HTTPS 代理确认为 `customDomains=["xxian.fun"]`、`127.0.0.1:18443`。
- 此次 Windows DNS 查询 `xxian.fun` 同时返回 `120.79.1.21`、`47.114.98.109`；`www.xxian.fun` 返回旧 IP。这是本次查询快照，不表示已完成旧记录清理。旧入口转发行为依据上轮迁移记录，本次未登录旧服务器复查。
- 仅核实状态及更新文档，没有重启容器、变更 DNS/隧道、读取密钥内容、改 CI 或重跑恢复脚本；用户账户登录和完整业务链路仍以用户验收为准。

日常只读入口：

```powershell
ssh rong-frp
```

```bash
sudo docker -H unix:///var/run/docker.sock ps
curl --connect-to xxian.fun:443:127.0.0.1:18443 https://xxian.fun/health/ready
curl https://xxian.fun/health/ready
```

## 16:43 后的正式切流更新

- 用户在阿里云新增了节点 A 记录，权威 DNS 同时返回 `120.79.1.21` 和旧 IP `47.114.98.109`。助手未修改 DNS。
- 短暂停止旧 MapFlow 应用，保留旧数据库和容器；在停止写入后取得最终快照，时间为北京时间 2026-10-06 16:43:19。源端 `final-database.dump` SHA-256：`cf8bf8a4f8087faab3a56aa1ac5288774f1ca62da184da047087b8cec46a641e`。
- 对笔记本独立数据库先备份，再恢复该最终快照，账号数量核对为 326。`final-sync-complete.json` 与 `pre-final-target.dump` 保存在笔记本私有运行目录。
- 在笔记本既有 FRP 配置中追加 HTTPS 代理：`oW7yXIiZk2ke`，`127.0.0.1:18443`，`customDomains=["xxian.fun"]`，保留现有两个 SSH 代理、认证信息及映射。修改前备份、frpc verify 通过；重启 FRP 后 SSH 与网站代理均已接通。
- 新节点 `120.79.1.21:443` 的 HTTPS 首页和 readiness 返回 200，正常 DNS 访问也返回 200。
- 旧服务器 Caddy 改为通过 HTTPS 转发至节点 IP，明确 SNI/Host 为 xxian.fun，证书校验保持启用。旧 IP `47.114.98.109:443` 的首页与 readiness 也返回 200，因此缓存及重复 DNS 指向旧入口的请求仍落到笔记本。
- 旧 MapFlow 应用保持 stopped，旧 PostgreSQL 保留用于回退。当前只有笔记本应用接收网站业务写入，避免两套数据库分叉。旧 Caddy 的修改前文件保存在源端私有备份目录 `Caddyfile.before-cutover`。

用户下一步：阿里云 `@` 的 A 记录仅保留 `120.79.1.21`，移除旧值 `47.114.98.109`；再用自己的账号验证登录和个人数据。旧入口暂时保留处理缓存。

回退注意：笔记本已经可能接收新写入，不能简单启动旧应用。回退前须暂停新站写入并将最新数据同步回旧库，再恢复旧 Caddy 配置和应用。

自动部署流水线的目标尚未迁移；不要让旧服务器的自动部署重新启动旧应用。改 CI 目标或部署方式需要后续独立处理。

## 已完成

- 读取阿里云当前运行的 MapFlow、pgvector/PostgreSQL 16、Caddy 容器配置，导出当前镜像，未重新编译或混入开发分支。
- 对 MapFlow 数据库执行一致性逻辑备份，并备份角色、服务端配置、文件型密钥、Caddy 数据与证书。没有复制另一个项目的容器或数据库。
- 通过既有私有 SSH 将镜像和运行备份直接传到 Linux 笔记本。没有上传 GHCR、Docker Hub、Git 或其他公开存储。
- 镜像归档约 271 MiB，运行归档约 6.7 MiB；两端 SHA-256 一致。密钥未打印、未写入镜像或业务环境变量。
- 笔记本系统 Docker 已安装、运行并启用开机启动；使用其系统 socket，不使用当前未运行的 Docker Desktop socket。
- 恢复到独立网络、独立数据卷及独立容器，现有钱包/酒馆测试数据库和开发进程保留。

源端私有备份目录：`/opt/mapflow/laptop-migration-20261006`。

笔记本私有运行目录：`/opt/mapflow-laptop-migration-20261006`，权限 700；其中归档、manifest、密钥和证书不得提交 Git。备份导出完成时间：北京时间 2026-10-06 16:23:04，具体时间保存在 `snapshot-ready.json`。

## 容器与端口

| 容器 | 内容 | 笔记本入口 |
| --- | --- | --- |
| mapflow-laptop-postgres | 线上 MapFlow 数据库副本，pgvector/pgvector:pg16 | 独立 Docker 网络内，不发布数据库端口 |
| mapflow-laptop-app | 线上镜像 canary-a8902e56b8a753e20d772b5bb2bd30e8b94babb7 | 127.0.0.1:18092，内部端口 127.0.0.1:18093 |
| mapflow-laptop-caddy | 线上 Caddy 镜像和有效证书 | HTTP 127.0.0.1:18090，HTTPS 127.0.0.1:18443 |

网络：`mapflow-laptop-migration`，子网 `172.31.66.0/24`。Caddy 固定地址 `172.31.66.4`，应用的可信代理配置随之更新。数据库卷：`mapflow_laptop_pgdata_20261006`。

三个容器均使用 `restart=unless-stopped`。应用保留非 root 用户、只读文件系统、禁用 Linux capabilities、no-new-privileges 和独立 tmpfs，内存上限 1 GiB。凭据通过只读文件挂载。

注意：此副本保留线上 `https://xxian.fun` 的身份 Origin 和 Caddy 域名。将隧道改为 test.xxian.fun 时，还需同步准备对应证书与身份 Origin，不能仅改 DNS 后宣称已适配。

## 验证证据

- 三个运行容器的镜像内容 ID 均与源容器完全一致。
- PostgreSQL 恢复无错误，35 张 public 业务表；326 个账号，与源端重新查询数量一致。其余恢复统计保存在笔记本 `restored-table-counts.json`，没有输出个人数据。
- 首页静态文件 SHA-256 与旧服务器一致：`003ae7186d9172a5651bca27ace341baed6ec831378dfa433ddbc641c6f39231`。
- 通过 Caddy 访问首页与 `/health/ready` 均返回 200，验证了 HTTPS 证书和反向代理链路；未使用跳过证书检查的参数。
- `/api/auth/session` 在未携带登录凭据时返回 401；没有冒用用户账号或执行真实付费操作。尚未进行浏览器登录、生成技能树或真实模型聊天验收。
- 只重启三个迁移容器后，数据库健康、HTTPS 首页和 readiness 再次通过，账号数量保持 326。未重启主机，也未扰动已有开发容器。
- 原阿里云网站持续返回 200，域名解析保持原样。

本次验证使用 Linux 命令（保留真实域名、Origin 及 TLS 校验）：

```bash
curl --connect-to xxian.fun:443:127.0.0.1:18443 https://xxian.fun/health/ready
sudo docker -H unix:///var/run/docker.sock ps
```

## 操作与复原材料

笔记本目录中保留 `restore.py`、`finish.py`、`verify.py`、`container-manifest.json`（runtime 子目录）及验证结果。restore.py 针对空的目标容器、网络和数据卷，存在同名资源时会拒绝覆盖；不要在已部署实例上重复运行。

导出 Caddy 时使用了镜像 digest 名称，Docker 导入后只保留了内容 ID，首次启动因此尝试寻找仓库名称。最终使用原镜像内容 ID 启动，避免从公网重拉。修正后的 restore.py 已同步保存。

日常状态检查及重启只针对这三个迁移容器：

```bash
sudo docker -H unix:///var/run/docker.sock ps
sudo docker -H unix:///var/run/docker.sock restart mapflow-laptop-postgres mapflow-laptop-app mapflow-laptop-caddy
```

数据卷不会因容器重启而消失。不得删除该数据卷或覆盖 runtime 中的密钥。恢复副本使用了真实生产密钥，验证阶段限制在回环端口。

## 初次副本阶段的待办与当前状态

1. 网站 HTTPS 隧道已完成；原 SSH 隧道保留。
2. 公网 HTTPS 首页及健康检查已完成，登录与主要功能待用户验收。
3. 最终数据同步与旧应用停止写入已完成；初始快照时间已被最终快照取代。
4. 重复 A 记录待用户移除，旧入口目前转发新站，回退材料保留。

线上当前镜像不含笔记本开发分支中尚未发布的钱包/酒馆新功能，后续发布需单独处理。Vmq 也是独立服务，本次没有将其部署或伪装成已接通支付回调。
