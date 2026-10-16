# BYOK 请求隔离与停止恢复发布

2026-10-17，经用户确认，前后端及配套 Worker 已发布至 <https://xxian.fun/>。本站现金请求明确拒绝后保留输入，用户切换 BYOK 再发送时使用当前配置和新操作标识；原请求身份不明时继续核对原操作。BYOK 未知上游调用保留依据并结束本轮，不自动重发；停止后原调用证据独立、有界收尾。

## 固定版本

| 项目 | 发布值 |
| --- | --- |
| 前端 | `bfd508b4478e81f2265c7430e834939dcc670cd8` |
| 后端及 Worker | `4fec6b9912ff0931555cddbf1f0575aff39dad0a` |
| 应用镜像 | `mapflow-server:byok-repair-20261017-4fec6b9` |
| 镜像 ID | `sha256:0c544da93395d92f04ee32d2cc4aa0f51e1c115b4b9a2c44f7bcf2fdb10067c3` |
| 原镜像 | `sha256:87796a6edf7071b8ba7f1ecd2a90e3940b07927015ad7e61d2d40d2a29282bc8` |
| 数据库 | 原 schema58，无迁移，历史迁移行一致 |
| 知识推理镜像 | 原 `sha256:db3ebab1e2673d69176ac4c7c1a1b39d0dc29c8091c7cc594412b9e246fd3ffd` |

## 验收与保留

- 实施验收为前端 660 通过、1 跳过、1 项在未修改 main 同样失败的登录深链接测试；后端全套 1089 通过、10 ignored，显式过滤两项既有 Windows 网络/权限失败；Worker 200 通过、1 跳过。类型、构建、Rust fmt/Clippy 和关键增量回归已完成，详见 [设计及实施记录](../specs/2026-10-16-byok-execution-design.md)。
- 本次 40 项既有部署保护测试通过。Linux 无网络容器从固定 Git 归档执行 `cargo build --offline --release --locked`；首轮缺少引擎 Git 缓存，补齐此前已保留的离线缓存后完成构建，未改变产品源码或锁文件。
- 396 个前端文件、14 个 Worker 文件逐 SHA-256 校验；17 个运行文件仅服务器、管理二进制、`harness.js`、`protocol.js` 改变，Node 与 SDK 依赖保持。真实 Linux Worker 启动及 shutdown 协议验证 `evidenceDrain: true`；旧前端状态仍为原 7 字段，新增 control v1 使用独立接口。
- 生产热备完整恢复到独立 internal 网络的 PostgreSQL 副本，实际启动原应用验证回退兼容。副本新建专用账号，在本站余额 `-50000` micros 下验证现金返回 `402 cash_non_positive`、BYOK 返回 200、显式停止、control v1、跨账号 404 和本站余额不变。使用合成 Key 与不可解析测试域名，没有真实服务商调用。
- 切换前确认没有活动生成，4 条无活动拥有者的历史待核对执行完整保留。维护窗口内冷备 `before-cutover.dump` 为 30,699,539 字节，SHA-256 `614f604cff7fb5e6ea9d6ad9bb6333028750a79acc76716db8416142b550ee14`，`pg_restore --list` 可读 591 项。热备已实际恢复验收；冷备目录读取不冒充完整恢复演练，也没有恢复到生产。
- 89 张表逐项核对，普通业务记录和迁移记录一致。访问观察记录依据原有上限策略移除 50 行、保留 20,000 行旧记录并新增 9 行；删除顺序及保留行摘要验证通过。没有修改用户钱包、聊天、历史上游调用或管理员核账结果。
- 应用环境、密钥挂载、网络/IP、用户、资源与支付配置保持。PostgreSQL 容器保持；知识推理伴随容器以原镜像和挂载重建到新应用网络命名空间，健康、模型文件及真实 CPU 嵌入检查通过。
- 公网 14 个应用路由、受保护 API 和就绪检查通过；下载 HTML、入口 JS/CSS 与冻结文件逐字节一致。独立匿名 Chrome 完成 320/390/1024/1440px、浅/深色共 5 张截图，人工查看手机截图，无横向溢出。生产未借用用户账号登录或发送消息；已认证 BYOK 交互由生产副本及本地真实 API 验收覆盖。

## 运维与回退

私有发布包：`/home/rong/.local/state/mapflow/byok-repair-20261017/`。发布目录：`/opt/mapflow-laptop-migration-20261006/releases/20261017-byok-repair/`。来源、构建清单、容器原配置、备份、隔离/生产验收和回退记录保存在宿主私有目录，未提交密钥或数据备份。宿主 `OPERATIONS.md` 已更新。

```sh
sudo python3 /home/rong/.local/state/mapflow/byok-repair-20261017/2026-10-17-byok-release.py rollback
```

恢复 `mapflow-laptop-app-before-byok-20261017` 与 `mapflow-laptop-knowledge-before-byok-20261017`；保留 schema58 和上线后的全部新记录，不得用历史备份覆盖当前数据库。历史 BYOK 未知记录未批量改写，用户仍可先结束旧请求，再主动新发。

本地发布证据：`D:/tmp/mapflow-byok-deployment-20261017/`。全部 Codex 会话、原路径、worktree 和此前 stash 保留。
