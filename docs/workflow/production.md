# 生产与收款运行入口

核对日期：2026-10-18。本页只说明当前入口，发布与回退需读具体版本的记录。

## 站点

生产是 Linux 笔记本上的系统 Docker。SSH 使用 rong-ubuntu 或 rong-frp，运行目录为 /opt/mapflow-laptop-migration-20261006。

```sh
sudo -n docker -H unix:///var/run/docker.sock ps
sudo -n sed -n '1,20p' /opt/mapflow-laptop-migration-20261006/OPERATIONS.md
```

应用、数据库、入口和知识服务为 mapflow-laptop-app、mapflow-laptop-postgres、mapflow-laptop-caddy、mapflow-laptop-knowledge。不要用默认 Docker Desktop socket 判断生产不存在。

生产提交见[当前发布](../current-release.md)。发布绑定明确 SHA、备份和兼容验证；知识伴随服务共享应用 loopback，重建应用时核对其绑定和健康。

旧 CI 仅手动触发，仍固定旧前端并调用 /opt/mapflow/switch.sh，不是当前笔记本的发布器。旧阿里云自动部署保持停用。

2026-10-18 权威 DNS 已只保留正常入口 120.79.1.21，TTL 600 秒。旧迁移资料中的双地址是历史状态，不用于恢复解析。

## Windows 收款

MapFlow-Vmq-Relay 是 Windows 自动启动任务：登录等条件满足时启动转发脚本，并按保存的策略重试。它是运行入口，不是给 AI 阅读的文档入口。

2026-10-18 已迁移到独立运维入口：

D:/MapFlow-operations/vmq-relay/Connect-Vmq.ps1

Action 的脚本路径及工作目录已更新。原脚本按字节复制；登录触发器、失败重试、运行身份、其他设置和任务权限保持原值。迁移时发现旧 SSH 孤儿进程占用端口，核对进程身份后清理，再连续两次受控启动验证新脚本独立建立转发。

验证结果：新 PowerShell/SSH 进程、127.0.0.1:28080 监听、收款服务 HTTP 200、MuMu device 状态和 ADB reverse 均正常。实际重新登录 Windows 和新的真实付款本轮未测试；连接正常不代表新交易已完成自动入账。

旧脚本 D:/MapFlow-payment-listener/installers/windows-emulator-20261006/Connect-Vmq.ps1 仍保留作回滚，不再是当前任务入口。原任务 XML、权限和脚本备份保存在私有运维归档。需要回退时先停止并核对当前脚本及其 SSH 子进程，再恢复原 Action；脚本有单实例锁，不可同时启动两份后仅凭其中一份退出判断成功。

## 本地清理

先区分运行文件、可重建缓存、私有配置和原始证据，再清理已验证的具体目录。保留会话及关联路径。

前端大 Git 对象来自旧 Codex 自动快照里的模拟器镜像和安装包，不在 main 产品代码中。分支删除不会释放仍被检查点引用的对象；不直接删除 .git/objects 文件或立即裁剪来追求空间数字。
