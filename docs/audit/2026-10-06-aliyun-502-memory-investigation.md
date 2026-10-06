# 阿里云历史 502 与内存故障调查

调查日期：2026-10-06。全部时间为北京时间（UTC+8）。调查为只读，未修改资源参数、停止其他工作负载或制造线上故障。

## 结论与边界

已确认阿里云宿主机多次发生全局 OOM。2026-10-05 07:29 故障中，内核杀死了网站进程 `mapflow-server`，Caddy 同期开始报告后端连接被拒绝，之后大量请求返回 502。该次持续故障与宿主机内存压力有直接证据关联。

不能把所有历史 502 都归因于该次 OOM，也没有证据证明网站业务代码存在内存泄漏。部分较早 502 尚未逐次归因。当前退出码和 OOMKilled 字段不能代替历史日志。

## 核心证据

- 内核记录：`2026-10-05T07:29:27+08:00`，`oom-kill:constraint=CONSTRAINT_NONE,...global_oom,...task=mapflow-server,pid=526171`。
- 随后的记录：`Out of memory: Killed process 526171 (mapflow-server)`，匿名 RSS 为 204172 kB，即约 199.39 MiB。
- systemd 记录该应用 scope 被 OOM killer 杀进程，历史内存峰值为 298.4M，swap 峰值为 0B。应用容器配置的 RAM 上限为 512 MiB，说明这次不是应用容器超过自己的硬限额。
- 故障进程表中同时存在 5 个 `claude` 进程，RSS 合计约 707.79 MiB。它们与网站进程、数据库、Docker 和系统服务共享只有约 1.6 GiB 可用 RAM 的宿主机。
- 历史 OOM 日志出现 `task_memcg=/system.slice/cc-connect.service,task=claude`。当前 `cc-connect.service` 的 `MemoryMax`、`MemoryHigh` 都为 infinity。该工作负载缺少内存隔离，是本次资源争抢的重要因素；这些进程是否为预期会话、为何积累到五个，尚未核对其应用生命周期。
- 故障时日志显示 2 GiB swap 全部空闲，任务 swapents 为零；当前 `vm.swappiness = 0`。不能直接把当前参数当作故障时配置，swap 策略还需核对历史来源。
- 同期 journald、resolved 出现 watchdog 超时，Docker daemon 在 07:29:20–21 等待 containerd 恢复事件处理。故障影响超出网站本身。仅凭这些记录尚不能确定容器没有及时恢复的完整原因。

## 502 时间关联

读取旧 `mapflow-caddy` 自 2026-09-24 起的保留日志，扫描 26145 条 JSON 记录。只统计 `http.log.access.*` 的实际请求，排除同一请求另记的 `http.log.error.*`，避免把请求数翻倍。

| 日期 | 502 请求数 | 说明 |
| --- | ---: | --- |
| 2026-09-28 | 2 | 未逐次归因 |
| 2026-09-29 | 26 | 未逐次归因 |
| 2026-10-02 | 3 | 未逐次归因 |
| 2026-10-03 | 1 | 11:03:52 返回 502；同秒内核记录全局 OOM 杀 fwupd，关联但不能仅据此证明直接原因 |
| 2026-10-05 | 265 | 首次 07:29:22，末次 23:50:28；与 07:29:27 OOM 同一故障窗口，错误包含后端 connection refused |
| 2026-10-06 | 290 | 00:02:11–16:45:19；混合之前故障与当天迁移操作，不能全部算作自然故障 |

首条 502 比内核 OOM 记录早约五秒；准确表述为同一故障窗口，不能声称内核记录时间早于首条 502。

跨启动记录在 8 月 6、10、14、18、25 日，9 月 16、30 日，10 月 3、5 日都可见内存相关 kill。8 月 10 日为 PostgreSQL 容器内存 cgroup OOM，其余多次为 global OOM；该历史数据库容器 ID 与当前容器不同，不推定其当时限额。

10 月 6 日 15:42 的系统记录为正常 poweroff 流程，15:43 再启动；发起来源尚不明确，不能说是 OOM 直接造成整机重启。当前旧网站容器退出 137、FinishedAt 16:43:14 对应本次迁移停止，不应算作历史 OOM 证据。

## 笔记本资源现状

生产容器运行在 Linux 系统 Docker `/var/run/docker.sock`，不在 Docker Desktop 引擎。

笔记本为 i5-1135G7，4 个物理核心、8 个逻辑 CPU，系统可见 RAM 约 14.81 GiB。

| 容器 | RAM 硬限额 | CPU 时间配额 | 本次空闲采样 RAM |
| --- | --- | --- | --- |
| mapflow-laptop-app | 1 GiB | 2 个逻辑 CPU 的时间额度 | 26.61 MiB |
| mapflow-laptop-postgres | 未设置 | 未设置 | 107.8 MiB |
| mapflow-laptop-caddy | 未设置 | 未设置 | 13.21 MiB |

应用 MemorySwap 为 2 GiB，即 RAM + swap 合计上限 2 GiB；不是另外允许 2 GiB swap。三个生产容器本次合计约 148 MiB，属于空闲快照，不能作为并发负载峰值。

Docker 直接使用宿主机 CPU。应用的 2 CPU 配额不是独占两颗物理核心；没有设置 CPU 绑核。数据库和 Caddy 当前未限定 CPU/RAM，与系统和其他程序共享可用资源。容器限额是上限，不代表预先分配并占满。

CPU 与内存配额语义参考：https://docs.docker.com/engine/containers/resource_constraints/

## 后续优先事项

1. 对生产与 AI/开发工作负载做资源隔离；尤其核对 cc-connect 的 Claude 会话回收和并发数量，不能仅给网站提高内存上限。
2. 根据笔记本实际负载补齐数据库、Caddy 的 RAM/CPU 上限，给宿主机和桌面程序留余量；先确认配置再变更。
3. 建立宿主机可用内存、OOM、容器状态、外部 ready 与 502 的观测及故障关联。自动重启策略已经是 unless-stopped，但本次未能避免长时间不可用。
4. 补充 Docker 日志轮转。旧机根盘约 89% 使用、journal 约 1.8 GB、容器 json-file 配置未指定轮转；属于风险，尚无证据证明它是该次 502 主因。

当前网站已迁移至笔记本，本次再次通过笔记本 Caddy 的真实域名证书访问 `/health/ready`，返回 `status: ok`。

## 补充：Claude 进程积累的源码与日志证据

用户追问已有队列为什么仍有五个进程后，核对了网站源码、服务器机器人配置与对应版本的机器人源码。服务器实际运行 `cc-connect v1.3.3`，commit `fd6dbcc`，源码审计副本在 `D:\codex-temp\cc-connect-audit-fd6dbcc\cc-connect-fd6dbcc`。这次是历史故障与源码核对，没有在线上重新制造 OOM，也没有部署修复。

- MapFlow 的生成队列使用信号量限制网站生成任务；平台规划还有独立队列。网站的 DeepSeek harness 启动 Node worker，不启动这组宿主机 Claude CLI。它们与 `cc-connect.service` 是独立工作负载。
- cc-connect 的消息队列限制每个会话的排队深度（默认 5），会话锁只限制同一个会话。审计版本没有对所有 Claude 会话设置统一进程数量上限。队列深度 5 不等于整机最多五个进程。
- 服务器有一个启用的每日任务，表达式 `7 9 * * *`，`session_mode=new_per_run`，未指定超时，使用默认 30 分钟。
- 后续核对确认该任务描述为「每日早安闹钟」，目标平台是 weixin；cc-connect 项目使用 claudecode，接入 weixin 与 qqbot。服务文件时间为 2026-06-26 01:00:52，不是本次网站迁移新安装的服务，安装或配置者尚未查明。先前口头说「等你确认」不准确：日志只能证明该机器人在等待权限回复，不能确认应该由谁回复。
- 笔记本实际生产环境明确设置 `MAPFLOW_GENERATION_RUNTIME=deepseek-harness`、`MAPFLOW_GENERATION_WORKERS=4`。网站用户的 DSH 与这个早安机器人属于独立服务；不能把 cc-connect 的 Claude 当成网站模型。
- 9 月 30 日至 10 月 4 日，每天 09:07 都记录 `cron: executing job` 和 `session spawned`，09:37 都记录 `job timed out after 30m0s`。9 月 30 日至 10 月 3 日分别记录了 `permission request`。每天的会话键不同，与每次新开会话相符。
- `core/cron.go` 的超时分支只设置失败错误并记账，没有向正在执行的任务传递取消信号、关闭会话或终止 Claude 进程。随后调度器可再次启动任务。
- `core/engine.go` 在等待人工确认时先停止 idle timer，再直接等待 `pending.Resolved`；此等待没有同时监听取消或任务截止时间。新会话分支的清理只有处理函数返回后才会执行。因此每日任务卡在确认阶段时，外层报超时并不等于进程退出。
- 这些行为能解释旧任务跨天残留与进程积累。OOM 快照没有保存每个 PID 的启动命令、开始时间和会话映射，不能声称五个 PID 已逐个与五次定时任务完成一对一追溯。

修复应针对机器人：让超时和取消真正中断确认等待并终止所属进程；同一定时任务前一次未回收完不得再开新实例；补齐机器人总体并发与内存隔离。不能只调整网站的生成队列，也不应通过自动批准全部工具权限来绕过清理缺陷。修代码须先按全局规范确认方案，再写回归测试验证超时等待与重复调度场景。

对应版本源码：

- https://github.com/chenhg5/cc-connect/blob/fd6dbcc/core/cron.go
- https://github.com/chenhg5/cc-connect/blob/fd6dbcc/core/engine.go

## 已执行：停用早安任务

2026-10-06 用户明确授权停用「每日早安闹钟」。通过 cc-connect 正在运行的本地管理 API 将该任务 enabled 改为 false，保留原任务便于恢复；配置及调度器均已更新。未停止整个微信/QQ机器人服务。操作前宿主机已经没有 Claude 进程，因此无需执行进程 kill。

同时实查笔记本生产容器：网站主进程之外还有一个实际可执行文件为 node 的 DSH worker，进程显示名为 MainThread，父进程为 mapflow-server。该 worker 本次 RSS 68732 kB。DSH 不是没有进程；它以共享的 Node worker 调用远程模型，不是给每个网站用户启动一个 Claude CLI。网站健康检查正常。
