# 主题与亮色地图生产发布

日期：2026-10-16。用户授权：「部署一下吧」。生产入口：<https://xxian.fun/assistant>。暖纸浅色、石墨深色、地图关系流光、完成反馈及节点状态底色已发布。

## 版本与边界

| 内容 | 已验证身份 |
| --- | --- |
| 前端产品源码 | `5c8ce2e38766217f8aa5cd22a5d72ffa5c0cd587` |
| 应用镜像 | `mapflow-server:material-themes-20261016-5c8ce2e` |
| 应用 image ID | `sha256:8bfd98b0afdaab7889efe162717eb544337fd37ffa7ec2c714f0e496009be3a2` |
| 原应用 image ID | `sha256:692036c4bc8d8ac0c70f581f362548bc5d70d20b684ead06b74777dda89a898d` |
| 保持原样的后端产品版本 | `900798a38bf6f5493fd3f97cf9985f9ac91f25df` |
| 保持原样的知识推理 image ID | `sha256:db3ebab1e2673d69176ac4c7c1a1b39d0dc29c8091c7cc594412b9e246fd3ffd` |
| 396 个已验收前端文件的上传归档 SHA-256 | `ddc8c121eb64918ea78128a654dda7adf1a17c8a452e3a973d55d99ecd71d8a8` |
| 冻结发布脚本 SHA-256 | `403c48e0ddc70221cf14f25bc972d89bee80e69180b095e6acf2dfdb459d5830` |

此次仅替换前端。以原生产镜像为基础，清除旧静态目录后写入验收构建，确认原镜像层保留，17 个 Rust、Node 和 Harness 运行文件逐一一致；候选镜像中的完整前端文件集合与验收清单一致。没有发布本机后端 main 的其他内容，也没有执行数据库迁移。

前端产品构建与本次发布记录、运维代码提交分别登记。后续 Git HEAD 包含发布记录时，不能误认为产品又重新构建。

## 切换与数据

切换前拒绝活动执行及可恢复调用，允许原有 4 条持久化、无 owner/lease 的 `awaiting_reconciliation/external_outcome_unknown` 记录保留。短时维护中停止原知识服务和应用，冷备数据库 24,359,347 字节，保存完整原容器配置、迁移记录与逐表指纹，再切换应用。

保留原应用环境变量、运行用户、挂载、资源限制、重启和安全配置、网络/IP/别名及收款资料；仅更新两个前端版本标签。知识推理容器以原镜像和原模型重建，绑定替换后的应用容器 ID，完整配置只允许其网络命名空间变化。实际健康、模型文件及推理 smoke 检查通过。

PostgreSQL 容器和 schema57 保持原样，所有迁移记录完全一致。88 张表集合不变；除单独验证的请求观测日志外，全部记录数量及完整行摘要一致，包括用户、余额、聊天、地图、执行、结算和知识库。4 条待核账记录的完整行摘要、身份和调用状态保留。观测日志按既有策略删除 21 条（过期 2 条、容量策略 19 条），原 20,000 条保留行逐条验证，检查时新增 5 条；没有给日志表整体放行。

## 验证与范围

- 产品完整测试 557 通过、1 项既有跳过，TypeScript 和生产构建通过，使用已实际验收的同一构建；见[主题验收](2026-10-16-material-themes-acceptance.md)及[地图验收](2026-10-16-luminous-map-acceptance.md)。没有为了发布再次改变产品源码。
- 新增运维配置保护测试先因缺少实现失败，再实现转绿，共 9 项；覆盖后端版本、环境、挂载和双前端标签保护，以及知识服务绑定新命名空间且保留模型镜像和挂载。完整部署脚本测试 36 项全部通过，记录保存在本机 `deployment-tests.log`。
- 14 个公网页面/健康入口返回 200，应用内 14 个页面字节与验收入口一致，5 个受保护 API 的未登录请求返回 401；实际线上入口加载 `index-CJ6KJgc_.js` 和 `index-D_LHHBGG.css`。
- 实际浏览器检查两套主题的首页、登录页，覆盖 320、390、1440px，共 12 张截图，逐张查看，没有页面横向溢出；助手未登录保护正常。生产浏览器没有正式账号登录态，没有创建生产测试账号，没有声称重新执行生产登录后的聊天或地图写入。登录后交互在对应同哈希本机构建中已完成验收。
- 不额外启动生产数据库副本或第二套推理服务；此次运行层与数据库契约没有变化，候选检查为镜像文件、运行文件和原镜像层核对。维护切换后通过实际原应用、数据库、知识服务及公网访问验证。

## 运维与回退

远端私有发布目录：`/opt/mapflow-laptop-migration-20261006/releases/20261016-material-themes/`。冻结发布包：`/home/rong/.local/state/mapflow/material-themes-20261016/`，目录和文件已移交 root。私有配置、备份、原始数据库证据不进入 Git。本机非密日志与截图：`D:/tmp/mapflow-material-deployment-20261016/`。

回退入口：`sudo python3 /home/rong/.local/state/mapflow/material-themes-20261016/material_release.py rollback`。恢复保留的 `mapflow-laptop-app-before-material-themes-20261016` 和 `mapflow-laptop-knowledge-before-material-themes-20261016`，重新验证知识服务绑定、健康和原应用网络。保留当前数据库与后续活动，不用历史备份覆盖新记录。本次切换和收尾通过，没有触发回退。

已将发布说明加入服务器 `OPERATIONS.md`，保留旧应用、旧知识容器、所有 Codex 会话及原工作区路径。两个固定仓库入口在 main 上完成收尾核对。

仓库内保存相同字节的冻结工具：`docs/deployment/scripts/2026-10-16-material-themes-release.py`，保护模块为 `material_theme_release_checks.py`；发布包中分别命名为 `material_release.py`、`release_checks.py`，名称映射不改变代码字节。发布工具依赖服务器留存的上一轮已验证运维模块，不能独立当作通用部署器运行。
