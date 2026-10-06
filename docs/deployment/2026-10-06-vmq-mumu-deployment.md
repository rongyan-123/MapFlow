# Vmq 服务端与 Windows MuMu 监听联通记录

日期：2026-10-06。源码提交：c49f631。用户授权部署 PC 侧服务端，并使用已登录微信的 MuMu 安卓监听端联通。

## 运行入口

| 项目 | 实际配置 |
| --- | --- |
| 服务端主机 | Linux 笔记本 rong-ubuntu，通过 ssh rong-frp 登录 |
| 私有运行目录 | /home/rong/.local/state/mapflow-vmq |
| 服务 | systemctl --user status mapflow-vmq |
| 服务端端口 | 127.0.0.1:28080，仅回环监听 |
| 数据库 | 运行目录内 data/mq，独立 H2，不复用旧 ~/mq 或网站 PostgreSQL |
| Java | /usr/lib/jvm/java-8-openjdk-amd64，Xmx384m |
| PC 管理页 | http://127.0.0.1:28080/，经 Windows SSH 本地转发到笔记本 |
| 安卓地址 | 127.0.0.1:28080，通过 adb reverse 到 Windows 转发入口 |
| MuMu ADB | D:\MuMu\nx_main\adb.exe，设备 127.0.0.1:16384，Android 15 |
| Windows 连接助手 | installers/windows-emulator-20261006/Connect-Vmq.ps1，后台隐藏运行 |

链路：MuMu 通知监听端 → adb reverse → Windows 回环 28080 → 加密 SSH → Linux 回环 28080 → Vmq。未增加公网 Vmq 隧道，未开放管理端到互联网，未改网站 Docker/Caddy/FRP 配置。

## 部署与配置

- 部署已测试的 WAR，SHA-256：e758a8d3dbc60c41fa1521c2825325c5696b7d9def27771e3cfbefa3549cba87。
- 服务以 rong 用户运行，systemd 用户服务 enabled，Restart=on-failure、UMask=0077、NoNewPrivileges=true。数据库、通讯密钥与管理密码保存在 700 权限运行目录，H2 控制台关闭。
- 默认 admin/admin 已替换为独立管理账号及随机强密码，通讯密钥随机生成。私有凭据文件为运行目录的 credentials.json；不能提交 Git 或直接打印到共享日志。
- 安卓 com.shinian.pay 3.0 是 debug 包，通知服务已绑定。由于 UI 自动读取偶发崩溃，通过应用自身 run-as 沙箱写入 shinian.xml，再仅重启监听应用使配置生效。没有停止微信，也没有清除微信或监听日志数据。
- Windows 转发助手持有专用 mutex 防止重复运行；SSH 退出后重连，并定期恢复 MuMu 的 adb reverse。助手 PID 与日志保存在 Windows 用户 LOCALAPPDATA\MapFlow-vmq。没有添加 Windows 登录自启动。
- 初始组合命令被自动审批拦截；最终仅建立本地回环转发并将凭据留在 Linux，安卓配置时仅在内存读取密钥，没有把凭据复制到 Windows 文件。

## 验证

- Maven 完整测试 9/9 通过；该 WAR 在先前审计已成功打包。
- 服务端启动成功，管理端身份更新后登录通过，模拟签名心跳通过。
- Windows 管理页 HTTP 200；安卓“检测心跳”日志成功。
- 安卓“检测监听”自测日志成功；自动心跳日志出现服务端 code=1，服务端 jkstate=1、lastheart 随后持续前进。
- 将监听应用退到安卓桌面后，64.6 秒的观察中服务端 lastheart 继续前进、jkstate=1，验证本次后台心跳；这不是长期保活验收。结果保存在私有运行目录的 background-heartbeat-result.json。
- 初始部署验收时微信进程仍运行，lastpay=0；随后用户发起真实 0.01 元微信收款，结果见下方真实收款验收。
- MapFlow 公网 /health/ready 保持 HTTP 200，生产容器不受此次部署影响。

## 操作

笔记本状态：

```bash
systemctl --user status mapflow-vmq
journalctl --user -u mapflow-vmq -n 30 --no-pager
```

Windows 重启后，启动 MuMu 再运行：

```powershell
pwsh -NoProfile -File D:\MapFlow-payment-listener\installers\windows-emulator-20261006\Connect-Vmq.ps1
```

如果 MuMu 实例或安装目录变化，需要核对脚本中的 adb 路径及端口。自动助手只恢复连接，不会启动 MuMu 或登录微信。ADB reverse 将服务入口映射到安卓 127.0.0.1，勿在没有该映射时把安卓回环地址误认为笔记本地址。

服务端私有 OPERATIONS.md 同步保存在运行目录，备份时保留整个运行目录和服务 unit。不要在实例运行时直接复制 H2 文件作为一致性备份；不要重跑首次初始化脚本覆盖现有数据。

## 真实收款验收

2026-10-06 用户完成一笔 0.01 元微信支付后，读取安卓现有监听日志及 Vmq 管理查询接口核对；没有人为调用收款上报接口或补单接口。

- 安卓监听日志出现“监听到微信支付收款0.01元”，服务端响应为“收款无法唯一匹配订单，需人工核实”。微信进程仍在运行。
- 服务端仅有 1 条收款记录：id=1、type=1（微信）、price=reallyPrice=0.01、state=3（待核实）、isAuto=0、param=无匹配订单。
- 服务端记录的事件时间为 18:57:24.408，保存时间为 18:57:25.014，均为北京时间。现有安卓实现使用监听处理时间作为事件时间，不能把该时间当作微信交易时间。
- 19:00:08 查询时 jkstate=1，最近心跳为 18:59:53.025。lastpay 已更新为本次事件时间；只保存了一条收款记录，没有发现重复入库。
- 本次验收确认微信真实收款通知 → 安卓解析 → Windows 转发 → 笔记本 Vmq 保存记录已经跑通。因事先没有创建待支付订单、notifyUrl 为空，未发生 MapFlow 订单回调或钱包自动入账。待核实状态符合现有服务端规则，不能手动当作某个用户的订单补单。
- 脱敏服务端证据保存在私有运行目录 real-payment-check-20261006.json；本记录不包含通讯密钥、管理密码或付款人身份。

后续工作：接通 MapFlow 创建订单及签名回调，再验证唯一订单匹配与钱包入账。源码审计中已记录的网络重试、通道记账和通知时间问题仍未修复。

## 支付宝通知排查（19:17 收款，尚未通过验收）

用户已安装官方支付宝 12.12.30.8000，在应用内“支付宝商家服务”看到 19:17 的 0.01 元到账消息，但安卓通知栏没有到账通知。用户确认付款时支付宝挂在后台，前台为 Vmq 监听端。

- ADB 确认 POST_NOTIFICATIONS granted=true、AppOps 默认 allow，支付宝进程存活且 stopped=false。安卓通知设置显示“此应用未发布任何通知”，初始 dumpsys 没有支付宝活动通知及通知通道；Vmq 仍只有先前微信记录。
- 检查支付宝内部“交易与账号安全通知”“服务通知”和商家服务“商家服务收款到账”均已允许；收钱提醒、个人收钱提醒、经营收钱提醒也已开启。
- “我的 → 设置 → 新消息通知 → 收钱到账语音提醒 → 系统通知栏展示收款概览”原为关闭。19:25 开启这一项；其他开关没有修改，没有清理应用或重装。
- 开启后创建 voice_helper 通道（importance=2），并发布系统通知：标题“收钱提醒助手正在为您服务”，正文“美好的一天从收钱开始~”。该通知是常驻服务提示，不是单笔到账通知，不能算支付宝收款验收通过。19:25:54 的 Vmq 查询仍仅有微信记录，jkstate=1。
- 已将支付宝退到后台并返回 Vmq 监听端，等待用户下一笔真实二维码收款。下一步同时核对通知正文与 type=2 记录；若只有汇总通知，须区分单笔金额和日汇总金额，不能直接按汇总数上报收款。

厂商官方排查资料同样区分系统允许通知和支付宝内部通知栏收钱提醒助手：https://consumer.huawei.com/cn/support/content/zh-cn00410681/ 。本次配置依据当前支付宝实际界面；旧版资料不能代替真实收款验证。

## 支付宝真实收款验收与后续发布

开启通知栏收款概览后，用户完成 0.02 元支付宝收款。系统通知标题“你已成功收款0.02元.”，正文“已转入余额 做生意收钱提现免费>>”。监听日志于 19:27:27.954 解析 type=2、金额 0.02；Vmq 于 19:27:28.294 保存 id=2、state=3、param=无匹配订单，没有重复入库。该记录没有付款人姓名，也没有对应网站订单，保留待核实。

20:23 左右网站自动充值已发布，监听端更新为 3.0.1 / code 14。当前自动充值实现、运行路径和真实网站订单验收状态见 [自动充值部署记录](2026-10-06-vmq-auto-topup.md)；本页前文保留各阶段的原始状态。
