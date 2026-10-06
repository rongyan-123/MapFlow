# 安卓收款监听开发前审计

日期：2026-10-06。工作目录：`D:\MapFlow-payment-listener`。分支：`codex/payment-listener-20261006`，提交 `c49f6316dc2cc6a628fe4c32bb02eed8b087f809`。基线：`codex/tavern-wallet-payments-20260930`。范围：新增的 `integrations/payment-listener`，未修改业务源码。

## 当前进度纠正

用户指出：安卓部署和虚拟机尝试已做过，当前卡在已试环境均无法稳定运行微信。重新核对 GitHub heads 与 Linux 原仓库后，远端本分支仍为 c49f631；Linux Vmq 独立仓库最新分支为 `codex/vmq-payment-listener`、提交 b0c8618（2026-10-06 15:08），其交接记录已随 c49f631 收录。分支未拉错，但首次审计把源码问题当作继续开发优先事项，没有充分呈现已经完成的部署排障进度。

已经完成：监听 APK 安装、通知权限自测、后台心跳；Android Studio AVD、Bliss 15/16 与多个微信版本的实际部署尝试。已知失败：AVD 的 libndk_translation 崩溃、Bliss 15 登录后的 libhoudini 崩溃、Bliss 16 登录及 push 进程 ANR/整机卡死、旧 ARM32 版本停启动页。Linux 原始证据仍在 `/tmp/wechat-crash-log.txt`、`/tmp/bliss16-wechat-push-anr.txt`、`/tmp/bliss16-wechat-8079-anr.txt` 等处，本次已读取后两项并确认 push/ARM 转译相关堆栈；这些原始日志未全部纳入远端分支。

后续应从安卓运行环境阻塞处承接，先复用已有排障日志，避免重复安装及重复尝试已失败组合。下方代码修复步骤仅为审计积压，不表示用户当前应重新从源码构建或模拟器部署起步。交接文档写 Waydroid 尚未安装，这是该记录的范围；不能据此忽略用户补充的“已试环境均失败”进度。

## Standards 轴

1. **P1：网络失败回调传 null，阻断补发。** `android-monitor/app/src/main/java/com/shinian/pay/util/NetworkClient.kt:95` 在六次尝试失败后向 `Callback.onFailure` 传 `uncheckedNull()`。消费者 `PayNotificationListenerService.kt:316` 等使用 Kotlin 非空 `Call` 参数，入口非空检查会抛异常，失败记账及 `scheduleRetryCallback` 无法执行。修复时应传递真实请求对象，并测试重试耗尽后失败回调恰好一次且能进入补发路径。
2. **P1：旧通知可能支付新订单。** `PayNotificationListenerService.kt:309` 把处理时刻作为 `t`，而非通知原始时间；`vmq-server/src/main/java/com/vone/mq/service/WebService.java:226` 用它检查订单时序。旧通知延迟交付或监听重连后，若已有唯一同金额新订单且近期无已匹配记录，就可能错误标付该订单。修复应区分通知事件时间与请求新鲜度，保留稳定事件身份；先补端到端构造请求的回归测试。此项也出现在 Spec 轴，不能重复计为独立问题。
3. **P1：备用心跳成功导致误回切。** `PayNotificationListenerService.kt:128` 对当前通道响应调用 `recordMainSuccess`，没有区分实际请求通道，也未要求业务成功。主通道持续不可用时，备用响应会被计为主通道恢复，触发回切。应以实际通道和业务结果记账，并通过独立主通道探活验证恢复。
4. **P2：连续计数没有相互清零。** `ChannelManager.kt:89` 主成功不清零失败计数，主失败不清零成功计数；三次非连续偶发失败也会切备用，历史成功可加速回切。应补失败/成功交替、备用运行、主探活恢复的状态转换测试，再修复计数。

未发现可证实的项目文档规范硬性违反。现有测试文件不能证明历史开发是否遵循 TDD。

## Spec 轴

依据：工作区 README 和 `vmq-server/docs/mapflow-listener-handoff.md`。

1. **P1：HTTPS 会自动降级 HTTP。** 合同要求“部署时需通过 HTTPS 保护整个链路”。`NetworkClient.kt:100` 与同步补发的 `:204` 交替尝试 HTTPS/HTTP，`:61` 允许跨协议重定向。TLS 连接失败后完整支付参数和签名可能经明文传送，HTTP 重定向也不能撤销已发生的暴露。应显式区分开发 HTTP 配置与生产 HTTPS，后者禁止降级，并覆盖 TLS 失败测试。
2. **P1：通知时序保护不完整。** 合同要求“通知时间不早于订单创建时间”，但安卓传的是处理时间。触发条件与 Standards 第 2 项相同。
3. **P2：交接路径未随迁移更新。** `mapflow-listener-handoff.md:36` 仍指向相邻 `VmqForks/Nanying666-Vmq-App-Optimized`，当前分支实际使用 `integrations/payment-listener/android-monitor`。

签名、50 秒窗口、相同 t 重放保护、唯一候选匹配、待核实状态不回调/不补单/不返回支付成功、补发保留原 t 并按备用密钥重签，均有实现。MapFlow 回调接收器与自动入账未完成是已声明边界，不算本次分支承诺遗漏。

## 本次验证

- Linux 隔离目录：`/tmp/mapflow-listener-audit-c49f631`，从目标提交归档复制，没有启动生产服务或修改现有数据库。
- 服务端：JDK 8，`mvn -B test package`，9 个测试通过，WAR 打包成功。
- 安卓：JDK 17、SDK 34，`testDebugUnitTest assembleDebug lintDebug`，79 个测试通过、APK 构建和 lint 成功。存在 Gradle 弃用及编译警告，不代表零警告。
- Windows 前端：459 个测试通过，1 个跳过，typecheck 成功。运行期间外部操作切回钱包分支；前端测试仅作共同前端基线验证，安卓和服务端验证使用固定 c49f631 隔离副本。
- Linux 启动脚本迁移：git blob 的 gradlew 为 LF，但本次 Windows 导出副本出现 CRLF；Git 文件模式为 100644，直接执行也缺少执行权限。首次 sh gradlew 失败，本次改用 Java 直接调用已提交的 GradleWrapperMain 完成验证。建议固定脚本 LF 并设置 executable，验证干净 Linux checkout 的 ./gradlew。
- 以上为已有测试和静态审计；本次未新增缺陷复现测试，也未验证微信/支付宝真实收款、MapFlow 回调或长期安卓保活。

## Linux SSH 与设备现状

已读 `D:\MapFlow-publish\Ubuntu-SSH-与防休眠说明.md` 和本机 SSH config，并实际登录验证：`ssh rong-frp`，用户 `rong`，主机 `rong-ubuntu`，x86_64。公网别名指向 `120.79.1.21:45709`；局域网别名 `rong-ubuntu` 指向 `192.168.137.23:22`，本次未测试局域网连通。

私钥配置：`C:\Users\Administrator\.ssh\id_ed25519_rong_ubuntu`，没有读取私钥内容。`ssh-frp`、`frpc`、`keep-awake` 用户服务均 active。已有 JDK 8/17 和 Android SDK 34，默认 java 是 25，因此构建须显式选择 JDK。检查时未发现 QEMU/Android Emulator/Waydroid 进程，未发现已安装 Waydroid 命令。

## 继续开发步骤与验证

建议先完成网络可靠性，再验证订单安全，最后接入新运行环境。每一业务修复遵循：先写回归测试并跑红，最小实现跑绿，再重构。

1. 修复网络失败回调与 HTTPS 降级；验证回调次数、异常不逃逸、补发触发、TLS 失败不发 HTTP。
2. 修复通道记账与连续计数；验证主故障、备用成功、主恢复的完整状态转换。
3. 明确事件身份、事件时间和请求时间的协议，修复旧通知匹配新订单；验证延迟通知、重放、进程重启和连续同金额付款。
4. 修复交接路径和 Linux 脚本迁移；验证干净 checkout 的文档构建命令。
5. 完整重跑 Maven 测试/打包、Android 测试/构建/lint，并自审 diff；再独立验收安卓环境、ARM 应用、登录、后台通知及真实小额支付。

涉及多文件业务修复，按用户规范先确认具体方案再写实现。本次只完成审计与环境准备。

轴内统计：Standards 4 项，最严重为失败回调崩溃与错误订单匹配；Spec 3 项，最严重为 HTTPS 降级与通知时间偏差。两轴有 1 项重复。
