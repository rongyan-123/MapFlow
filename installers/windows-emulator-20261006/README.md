# MuMu / 雷电：微信与支付宝收款监听安装材料

准备日期：2026-10-06。微信 0.01 元及支付宝 0.02 元均已在用户 MuMu 实例完成真实收款通知与笔记本 Vmq 入库验收。自动充值已发布，真实网站订单付款验收仍待进行。最新记录见 ../../docs/deployment/2026-10-06-vmq-auto-topup.md。

## 安装包

| 文件 | 版本与架构 | 用途 |
| --- | --- | --- |
| Vmq-Pro-3.0.1-auto-topup-20261006.apk | 3.0.1 / code 14，com.shinian.pay，Android 5.0+ | 当前运行版本：81 个单元测试、assembleDebug、lintDebug 通过；修复通知时间与网络失败回调，已覆盖安装保留配置 |
| MapFlow-Vmq-monitor-3.0-c49f631-debug.apk | 3.0 / code 13，com.shinian.pay，Android 5.0+，没有打包原生 ABI 库 | 当前分支 c49f631 构建的监听端，79 个单元测试、assembleDebug、lintDebug 通过 |
| WeChat-8.0.78-arm64-official.apk | 8.0.78 / code 3180，com.tencent.mm，arm64-v8a，Android 6.0+ | 当前 MuMu Android 15 已登录并完成真实收款通知验收 |
| WeChat-8.0.42-arm32-official.apk | 8.0.42 / code 2460，com.tencent.mm，armeabi-v7a，Android 6.0+ | 旧版 32 位备用，需要模拟器支持 ARM32；可能被登录端要求升级 |
| Alipay-12.12.30.8000-arm64-official.apk | 12.12.30.8000 / code 212310，com.eg.android.AlipayGphone，arm64-v8a，Android 7.0+，target SDK 35 | 官方 ARM64 包，186,828,123 字节；已验签，当前 MuMu Android 15 已登录并完成真实收款通知验收 |

微信包来自本机前期下载缓存，与 Linux 上对应包 SHA-256 完全一致。本次已使用 Android SDK apksigner 验证 APK 签名和 aapt 检查版本/架构。两份微信的签名证书 SHA-256 都是 `0fe4ff85c215918396dadc7cd8ce6963339af33d37751a56e54c7206b63a3c7c`，证书主体为 Tencent；没有修改或重签微信。

官方微信下载入口：https://weixin.qq.com/ 。8.0.42 官方下载链接：https://dldir1.qq.com/weixin/android/weixin8042android2460.apk 。8.0.78 缓存实际完整包哈希见 SHA256SUMS.txt；不要凭相同版本名认为不同官方小修订包哈希一致。

监听端使用 Android Debug 签名，证书 SHA-256：`2567d2f1858969f6eea788809f54bacab33cab11b9dc62241db7a7bd932f9e50`。如果已安装同包名但不同签名的版本，先备份配置再卸载旧监听端。源码与许可证在 ../../integrations/payment-listener/android-monitor，衍生来源 https://github.com/Nanying666/Vmq-App-Optimized ，原作 https://github.com/shinian-a/Vmq-App 。LICENSE 与 NOTICE 随目录附带。

## 最短安装顺序

1. 从 https://mumu.163.com/ 或 https://www.ldmnq.com/ 安装模拟器。当前材料先用支持 ARM64 的 Android 实例测试，模拟器不用开启 Root。
2. 将微信 8.0.78 APK 拖入模拟器，完成账号登录，先确认普通微信消息能出现在安卓通知栏。
3. 拖入监听 APK，授予“通知使用权”，允许通知、后台运行并取消电池限制。点“检测监听”，确认自测通知被识别。
4. 在监听端手动配置实际 Vmq 服务器地址与通讯密钥，点“检测心跳”。这里没有预填服务器或密钥；SSH 的 FRP 端口不是 Vmq 服务端口。Windows 模拟器也不能照抄 AVD 的 10.0.2.2。
5. 微信确认“微信支付/微信收款助手”以及相关服务通知开启；先检查真实收款消息是否进入系统通知栏，再核对监听日志和服务端订单。测试按钮只证明监听权限。
6. 若 8.0.78 在该模拟器不能启动，另建干净实例尝试 8.0.42 ARM32，保留错误截图。若提示版本过低，停止这个候选，不做绕过登录限制的操作。

## Vmq 研究结论

Vmq 上游明确支持模拟器挂机，使用系统通知监听，不依赖微信 Hook、Root 或改包，也没有给出当前 MuMu/雷电与某个微信版本的保证兼容组合：https://github.com/szvone/Vmq 。商业模拟器的 ARM 转译是否能稳定运行微信仍需当前实例实测，Linux Bliss/AVD 的失败结果不能直接代替 Windows 商业模拟器测试。

当前监听源码检查包名 com.tencent.mm，匹配标题“微信支付”“微信收款助手”等，并要求正文含“收款”、不含“已支付”，再解析金额。因此“微信登录成功”并不代表收款监听成功；没有通知栏收款消息时换监听 APK 不会解决问题。

Vmq issue 中有“普通消息正常、收款不进通知栏”的报告，以及用户关于开启“服务通知”的排查经验。这是历史经验，需要对照当前微信界面核查：https://github.com/szvone/Vmq/issues/34#issuecomment-1765566913 。不要直接修改收款设置而不记录原状态。

当前交付已修复网络失败回调和旧通知时序，MapFlow 自动回调已接入。历史审计报告：../../docs/audit/2026-10-06-payment-listener-audit.md 。当前状态以最新自动充值部署记录为准，少付、多付自动归属及充值排队方案尚未实现。

## 校验

PowerShell：`Get-FileHash .\*.apk -Algorithm SHA256`，与 SHA256SUMS.txt 对照。原有三个 APK 已完成传输后哈希核对；支付宝包已在 Windows 本地验签和读取清单。

## 支付宝准备与上游版本建议

- 官方页面 https://mobile.alipay.com/ 当前跳转到 https://render.alipay.com/p/yuyan/180020040001212700/ 。其公开页面配置直接提供 ARM64 下载地址：https://tfs.alipayobjects.com/L1/71/100/and/alipay_wap_main_64.apk 。本次从该 HTTPS 地址下载，不修改、不重签客户端。
- 使用 Android SDK 35.0.0 的 apksigner.jar 验签成功；签名证书 SHA-256 为 `389b49f7832f53e9017923220aa85e14dfaa4886ecd7428818bf339543cf498a`，主体 `CN=shiqun.shi, OU=alipay, O=alipay, L=beijing, ST=beijing, C=cn`。版本、包名、SDK 要求来自 APK 清单，ABI 来自原生库目录。
- 检查 szvone/vmqApk、shinian-a/Vmq-App 及 Nanying666/Vmq-App-Optimized 文档，没有找到锁定某个支付宝旧版本的推荐。原作 2022-11-28 的监听端 v2.1 发布说明称支持当时最新版支付宝店员监控：https://github.com/shinian-a/Vmq-App/releases/tag/v2.1 。这不是对 2026 年支付宝版本的兼容保证，也不是要求安装支付宝 2.1。
- 历史问题 https://github.com/szvone/vmqApk/issues/27 记录支付宝 10.1.80 与 10.1.95 的通知关键词在标题/正文之间变化，导致旧监听逻辑漏报。因此没有依据推荐这些旧包作为当前 MuMu 的稳定版本；本次先准备官方下载包作为测试候选。
- 当前已装的 MapFlow 监听端自带支付宝解析，不需要安装第二个监听端。识别包名 com.eg.android.AlipayGphone；支持标题“成功收款”且正文“已转入余额”、正文“通过扫码向你付款”，以及标题“店员通”或正文“支付宝成功收款”等模式，最终向 Vmq 上报 type=2、金额、时间和签名。

安装步骤：把支付宝 APK 拖入当前 MuMu，登录收款账号；在安卓系统及支付宝内允许收款通知，允许后台运行。保持现有 Vmq 地址、密钥和通知使用权配置，先将支付宝退到桌面，再由用户完成一笔二维码真实收款。核对系统通知、监听日志和服务端 type=2 记录；心跳成功不能代替收款测试。若没有上报，先取本次通知标题/正文判断是否需要适配文案，保留已成功的微信环境。

## 付款人姓名的能力边界

2026-10-06 的微信 0.01 元验收通知仍保留在安卓系统中：标题“微信支付”，正文“个人收款码到账¥0.01”，没有付款人姓名。当前 PaymentPushRequest 也只发送 type、price、t、sign，不发送昵称、姓名或平台交易号。即使其他通知文案包含昵称，也不能直接作为网站用户的可靠身份；后续应由网站创建的订单关联用户，再匹配收款完成入账。
