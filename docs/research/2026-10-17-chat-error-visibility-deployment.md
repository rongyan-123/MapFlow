# 正常生成异常卡片误报修复发布

2026-10-17，经用户确认，修复已发布至 <https://xxian.fun/>。全局助手正常生成时不展示“原请求状态”卡片，保留输入框停止按钮；实际失败、待处理异常及阻塞发送的旧请求保留恢复入口。后端正常在途调用返回 `reason=none`。

## 发布版本

| 项目 | 固定版本 |
| --- | --- |
| 前端 | `ae0917f4f95d7fd1279493fd55bfed030c90c2d0` |
| 后端 | `c6080cd86ed5bdd7aa8ca5d4d3d6e94d531906fc` |
| 镜像 | `mapflow-server:chat-error-visibility-20261017-c6080cd` |
| 镜像 ID | `sha256:7933600c7f5565ea19e7901b1246863f033e475781d2f56fbefe19152e19ef7b` |
| 原镜像 | `sha256:0c544da93395d92f04ee32d2cc4aa0f51e1c115b4b9a2c44f7bcf2fdb10067c3` |
| 数据库 | schema58，无迁移 |

## 验收证据

- 实施阶段前端 670 项、后端 1091 项测试通过；跳过项与 Windows 环境排除项见 [实施记录](../specs/2026-10-17-chat-error-visibility-design.md)。发布阶段既有部署保护测试 41 项通过，冻结提交重新构建前端，Linux 从 Git 归档执行无网络、锁定依赖的 release 构建。
- 396 个前端文件和 17 个运行文件逐 SHA-256 校验；仅服务器与管理二进制变化，Worker、Node、SDK 依赖及知识模型保持原内容。
- 生产热备实际恢复到独立 internal 网络的 PostgreSQL 副本，旧镜像可启动和回退。副本通过真实注册认证与控制接口，对现金、积分和 BYOK 的 4 个进行状态逐项对比：旧镜像重现 `external_outcome_unknown`，新镜像 12 项均返回 `none`；失败与待核对状态仍返回真实未知原因。另验证本站欠费时现金拒绝、BYOK 可受理、显式停止、旧状态字段和跨账号拒绝，没有真实服务商调用。
- 切换前确认没有活动生成，保留 4 条历史待核对执行。维护窗口内冷备为 31,401,293 字节，SHA-256 `9e87e2cee59c1e6b0b7d010dd2c3284d1ca68c1ce2116a8fdc9290b1aad32b86`，归档目录可读 591 项。热备完成实际副本恢复，冷备完成目录可读验证；未向生产恢复历史备份。
- 89 张表逐项核对，普通业务和迁移记录一致。请求观察记录按既有年龄和容量规则移除 28 行（年龄 10、容量 18），保留 20,000 条原记录并新增 9 行，保留内容摘要核对通过。应用环境、密钥挂载、资源限制、网络/IP、支付配置和 PostgreSQL 容器保持；知识伴随容器使用原镜像重建并通过健康和 CPU 嵌入检查。
- 公网 14 个应用路由、受保护接口与 readiness 验证通过，公网 HTML、入口 JS/CSS 与冻结发布包一致。Chrome 完成 320/390/1024/1440px、浅色和深色共 7 张截图；正常卡片隐藏、停止按钮保留、失败卡片显示，无页面错误或横向溢出，并人工查看桌面和手机截图。执行状态使用浏览器拦截的合成接口，后端行为在恢复副本独立验证；没有使用生产用户账号发送消息。
- 首次构建期间连接曾中断，按用户要求暂停；用户确认继续后核对原线上容器仍为旧版本、Linux 构建已成功，再进行副本验收和切换。

## 运维与回退

私有发布包：`/home/rong/.local/state/mapflow/chat-error-visibility-20261017/`。发布目录：`/opt/mapflow-laptop-migration-20261006/releases/20261017-chat-error-visibility/`。宿主 `OPERATIONS.md` 已更新，来源清单、容器配置、备份和完整验收证据原位保留；密钥和数据库备份未提交。

```sh
sudo python3 /home/rong/.local/state/mapflow/chat-error-visibility-20261017/2026-10-17-chat-error-visibility-release.py rollback
```

回退恢复 `mapflow-laptop-app-before-chat-error-20261017` 与 `mapflow-laptop-knowledge-before-chat-error-20261017`，保留 schema58 和上线后的全部记录。不得以旧备份覆盖当前数据库。

本机证据目录：`D:/tmp/mapflow-chat-error-visibility-deployment-20261017/`。Codex 会话、关联路径和已有工作区保持原位。
