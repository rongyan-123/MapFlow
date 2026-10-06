# MapFlow 收款监听工作区

此目录汇总 Linux 本地安卓与 V免签监听的可继续开发材料。分支 `codex/payment-listener-20261006` 从 MapFlow 钱包分支 `codex/tavern-wallet-payments-20260930` 建立。钱包申请与人工核实仍在 MapFlow 前后端；自动到账回调尚未接入，不能将监听自测当作真实付款成功。

## 目录与来源

| 路径 | 内容 |
| --- | --- |
| `vmq-server/` | V免签服务端完整源码、订单匹配保护、后台“待核实收款”界面、测试和[接入交接记录](vmq-server/docs/mapflow-listener-handoff.md)。来源为本机 `MapFlow-publish/Vmq` 的 `codex/vmq-payment-listener`，提交 `b0c8618`；上游为 [szvone/Vmq](https://github.com/szvone/Vmq)。 |
| `android-monitor/` | 优化版安卓通知监听端完整源码、Gradle wrapper、单元测试、README、LICENSE 和 NOTICE。来源为本机 `MapFlow-publish/VmqForks/Nanying666-Vmq-App-Optimized`；其 [README](android-monitor/README.md) 记录上游与功能。 |
| `local-vm/` | Bliss 15/16 的 QEMU 启动脚本备份。脚本含原电脑的绝对路径，在另一台电脑使用前须改路径与 KVM/OVMF 配置。 |

这里只提交源码、文档和启动脚本。Gradle/Maven 缓存、构建产物、APK、ISO、虚拟磁盘、UEFI 变量及账号数据均未复制进 Git。`vmq-server/src/main/webapp/v.apk` 是原 V免签服务端仓库自带的旧安装包，不能代表当前优化版安卓监听端；优化版 APK 应由源码构建。

## 2026-10-06 状态

- V免签服务端的模拟支付事件、重复上报、无匹配金额及后台待核实行为已经有测试；真实微信／支付宝收款事件、MapFlow 回调与自动入账均未通过验收。详细规则和测试记录在 `vmq-server/docs/mapflow-listener-handoff.md`。
- Android 11 x86_64 模拟器可安装优化版监控端，通知权限自测和向本机测试服务的心跳曾通过。这只证明监听端的部分链路可运行。
- 微信 8.0.78/8.0.79 在 Android Studio x86_64 模拟器的 `libndk_translation` 中崩溃；Bliss OS 15 曾登录后在 `libhoudini.so` 崩溃；Bliss OS 16 可进入登录页，但登录期间 `com.tencent.mm:push` ANR，安卓曾卡死。Bliss 16 网络已显示“已验证”，因此不能单凭登录转圈判为断网。
- [V免签原项目](https://github.com/szvone/Vmq)明确支持模拟器挂机，但没有给出当前 Linux 主机和微信版本的端到端成功记录。用户没有备用安卓手机；下一项本机候选是 Waydroid 配合可用的 ARM 转译层，仍需实测。不能据现有失败断言所有本地虚拟安卓都无法运行微信。

## 在另一台电脑继续

1. 拉取本分支，先在 `integrations/payment-listener/vmq-server` 运行 `mvn test`、`mvn package`；在 `integrations/payment-listener/android-monitor` 安装 JDK 17、Android SDK 34 后运行 `./gradlew testDebugUnitTest assembleDebug lintDebug`。
2. 若要恢复原有 Bliss 测试机，须从原电脑**单独安全复制** `/home/rong/.local/share/bliss-os/bliss15-wechat.qcow2`、`/home/rong/.local/share/bliss-os16-test/bliss16-wechat.qcow2` 及各自的 `OVMF_VARS_4M.fd`，核对脚本中的绝对路径；磁盘可能包含微信登录数据，不应上传公开 Git 仓库。
3. 优先验证本地安卓桌面、网络、ARM 包启动，再依次验证微信登录、重启后保持登录、后台通知、V免签真实到账回调。支付宝也须单独验收。一次失败保留日志和软件版本。
4. MapFlow 接入时让到账通知先进入“待核实”，由管理员根据支付平台流水确认，再通过现有钱包审批流程入账；具体边界见交接记录。
