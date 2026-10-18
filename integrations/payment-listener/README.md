# 收款监听源码与运行入口

更新：2026-10-18。本目录保留 V免签服务端、安卓通知监听端及历史虚拟机脚本的源码，代码已经合入 main；开发不需要切回旧钱包或监听分支。

当前运行方式是 Windows MuMu 监听微信／支付宝通知，通过 SSH 转发连接 Linux 笔记本的 Vmq 服务，再由 MapFlow Server 验证订单并处理额度。Windows 自动启动脚本已独立放到 D:/MapFlow-operations/vmq-relay/Connect-Vmq.ps1，由 MapFlow-Vmq-Relay 任务启动。它不依赖旧 worktree 的代码。当前生产版本和运维步骤见[运行入口](../../docs/workflow/production.md)与[当前发布](../../docs/current-release.md)。

| 路径 | 内容 |
| --- | --- |
| vmq-server/ | V免签服务端、金额匹配和待核实保护；[接入合同](vmq-server/docs/mapflow-listener-handoff.md)。 |
| android-monitor/ | 优化版通知监听源码、Gradle wrapper、测试及来源说明。 |
| local-vm/ | 早期 Linux Bliss 虚拟机脚本，保留作历史资料，不是当前收款设备。 |

仓库只存源码和说明。通讯密钥、微信登录数据、虚拟磁盘、安装包、编译缓存和私有部署材料单独管理，不随 Git 提交。原服务端内自带的 v.apk 是上游旧文件，不代表当前安装的安卓端。

## 接入与验证

当前回调已实现，不再是“等待开发”：后端 GET /api/wallet/payments/vmq/notify 会检查签名、充值申请、渠道、金额及 Vmq 已付订单，再在同一事务中处理订单、余额、流水和审计。重复回调不能重复入账。不匹配或无法确认归属的收款进入人工核实；用户点击“已付款”不能直接加额度。

2026-10-18 的入口迁移已完成两次新进程启动验证：SSH 监听、服务 HTTP 200、MuMu 在线和 ADB reverse 均通过，任务的登录触发、重试策略、运行身份和权限保持原值。本轮未发生新的真实付款；连接测试不等于自动入账验收。早期真实通知、人工核实和展示队列分别记录于[自动充值记录](../../docs/deployment/2026-10-06-vmq-auto-topup.md)及[展示队列记录](../../docs/deployment/2026-10-06-payment-display-queue.md)。

修改 Vmq 源码时在 vmq-server/ 执行 mvn test、mvn package；修改安卓端时按 android-monitor/README.md 配置 JDK/Android SDK，执行对应测试、构建和 lint。迁移设备另行验证通知权限、后台心跳、实际收款与网站订单，不能靠模拟通知宣称真实付款成功。
