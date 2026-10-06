# 合入 main 后恢复公共树库与自动充值

用户已批准把自动充值分支融合进 main 后重新部署。

## 原因和范围

首次 Vmq 自动充值发布从支付分支构建前端，漏合公共树库工作台。笔记本迁移版本的 `index-BSZpfrbT.js` 包含搜索和筛选；首次自动充值、注册及队列版本都没有。当前生产后端仍支持公共池归属信息和游标分页，旧前端只读取第一页。

前端 main 先合入 `codex/public-library-workbench`，再合入 `codex/payment-listener-20261006` 的已上线源码快照。保留目录搜索、来源/难度/节点规模筛选、排序、分页、预览、笔记和发布，同时保留钱包、Vmq、展示队列、酒馆和注册。管理面板冲突保留公共树与充值两个入口。

后端 main 合入 `codex/payment-display-queue-20261006`，包含 Vmq、0030 展示队列、最新收款码和注册；已有公共树及笔记服务继续保留。其他会话的目录和未提交内容保持在原工作区。

## 验证步骤

1. 整合测试先红：公共树库版本有搜索筛选，却没有充值入口。合并后同一测试通过，验证搜索、筛选和钱包路由共存。
2. 前端完整测试 479 通过、1 个原有跳过；类型检查、生产构建通过。MCP 转接器 28 个测试通过。
3. 后端完整 97 个测试目标、684 个用例通过，0 跳过；fmt 和 Clippy 通过，无新增代码警告。
4. 发布前固定两个干净 main 提交，从源码归档编译后端并携带前端构建。独立数据库副本验收通过才允许切流。容器被外部更换时停止发布，先整合其新源码。
5. 公网验收必须同时检查搜索筛选和充值资源、注册挑战、钱包及队列认证、伪造回调拒绝、原充值唯一流水和监听心跳。

## 发布与回退入口

前端 main 工作区：`D:\MapFlow-main-integration-20261006`。后端 main 工作区：`D:\mapflow-server-main-integration-20261006`。

笔记本连接：`ssh rong-frp`。使用系统 Docker socket `/var/run/docker.sock`；生产目录 `/opt/mapflow-laptop-migration-20261006`，发布目录 `releases/20261006-main-integration/`。Linux 后端源码 `/home/rong/project/mapflow/mapflow-server-main-20261006`。

镜像目标 `mapflow-server:main-integration-20261006`；两个准确提交号和构建证据记录在发布目录 `provenance.json`，镜像同时标注前后端提交与 `main`。前端入口 `index-C6Gd-e74.js`，CSS `index-BVpDpYKW.css`。旧应用保留为 `mapflow-laptop-app-before-main-integration-20261006`，冷备份 `before-cutover.dump`。

发布脚本在本目录 `scripts/2026-10-06-main-integration-release.py`，与它依赖的两份已有发布脚本同目录保存。运行配置、密钥挂载、Caddy 可信代理策略和 FRP 隧道沿用当前生产配置。

0030 已上线，本次无需新增数据库结构。回退只切换应用，恢复流量后禁止用旧备份覆盖新付款。旧阿里云自动部署继续禁用；后续功能先融合到 main，再固定前后端提交发布。
