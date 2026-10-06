# 更新日志 / 优化修复说明

本文件记录本分支相对[原版 Vmq-App](https://github.com/shinian-a/Vmq-App)的修复与优化。

> 本项目基于 **shinian-a/Vmq-App** 二次开发，遵循原项目 **Apache License 2.0** 开源协议。
> 原项目版权归原作者所有，本分支的修改内容同样以 Apache License 2.0 发布。

---

## 📦 构建产物（可直接安装）

| 项目 | 值 |
|:---|:---|
| **下载** | [Vmq-App-Optimized-v3.0-debug.apk](https://github.com/Nanying666/Vmq-App-Optimized/releases/latest/download/Vmq-App-Optimized-v3.0-debug.apk) |
| 版本 | versionName `3.0` / versionCode `13` |
| 包名 | `com.shinian.pay` |
| 体积 | 7.66 MB |
| 签名 | **Debug 签名** |
| SHA-256 | `39cf921f44d071241575c5a54f117d3fe718f072efca53c6068cdde3828012bb` |

> ⚠️ 原版 release 密钥存放于原作者的 GitHub Actions secrets 中，无法获取，故本版只能提供 Debug 签名包。
> 若已安装原版 release 包，因签名不同**需先卸载**再安装。

---

## 版本概览

| 项目 | 原版 | 本优化版 | 变化 |
|:---|:---:|:---:|:---:|
| Java 文件总数 | 48 | 38 | **−10** |
| 代码总行数 | 8440 | 7972 | −468 |
| 业务代码文件（`com/shinian`） | 27 | 17 | **−10** |
| 业务代码行数 | 5522 | 5054 | −468 |
| 运行进程数 | **1 主 + 5 子** | **1** | 单进程 |
| Manifest 服务声明 | 9 | 5 | −4 |

> 说明：删除了约 **1600 行**失效/有害代码，同时**新增 642 行**有效功能代码
> （`NetworkClient` 290 行 + `PermissionGuideHelper` 352 行）。

---

## 一、🔴 核心功能修复（11 个功能性 Bug）

### 1. 自动补单功能从未成功过（致命）

- **原版问题**：`scheduleRetryCallback()` 使用主线程 `Handler.postDelayed()` 执行**同步网络请求**。
  Android 禁止主线程网络 IO，第一次执行必然抛出 `NetworkOnMainThreadException`，
  被 catch 后仅弹一句“自动补单回调失败”。
- **后果**：首次回调失败后的**补单机制完全失效**，网络抖动直接导致真实掉单。
- **修复**：改为子线程执行（`Thread.sleep(1000)` + 同步重试请求），
  结果通过 `mainHandler.post()` 回主线程提示。

### 2. 心跳循环无异常保护，一次异常永久停跳

- **原版问题**：`while(true)` 循环体中仅 `Thread.sleep()` 有 try-catch，
  其余任何代码（SharedPreferences 读取、网络栈初始化等）抛出的未捕获异常
  会直接**杀死心跳线程**。
- **后果**：心跳永久停止，而 APP 界面显示正常，用户毫无感知。
- **修复**：整个循环体包裹 try-catch，异常记录日志后继续下一轮；
  仅 `InterruptedException` 时退出循环。

### 3. 崩溃处理器导致“僵尸进程”

- **原版问题**：`VmqApplication` 的全局 `UncaughtExceptionHandler` 记录异常后
  **不终止进程**（`killProcess` 被注释）。
- **后果**：主线程崩溃后进程仍存活，界面冻结、服务假死、无法再接收通知，
  用户误以为 APP 正常运行。
- **修复**：记录日志后转交系统默认处理器正常终止，由 `START_STICKY` 前台服务自动重启恢复。

### 4. 守护服务退出死循环

- **原版问题**：`DaemonService` / `PlayerMusicService` 在 `onDestroy()` 中
  **无条件自我重启**。
- **后果**：用户点击“退出 APP”后 `stopService` 反而触发服务重启，退出不干净、
  通知栏残留。
- **修复**：新增 `AppConstants.IS_USER_EXIT` 静态标志，用户主动退出后不再复活；
  被系统杀死时仍会自动重启（保活能力不受影响）。

### 5. 网络客户端持续泄漏

- **原版问题**：DoH DNS 解析每次调用都 `new OkHttpClient.Builder().build()`。
- **后果**：心跳每 50 秒触发一次 DNS 查询，**连接池与线程池持续泄漏**，
  长时间运行后内存占用不断攀升。
- **修复**：改为全局单例复用。

### 6. MediaPlayer 资源泄漏

- **原版问题**：`PlayerMusicService.stopPlayMusic()` 只调用 `stop()`，
  从未调用 `release()`。
- **后果**：每次启停服务泄漏一个 MediaPlayer 实例及其底层音频资源。
- **修复**：`release()` + 置 null，并捕获 `IllegalStateException`。

### 7. Android 13+ 申请已废弃存储权限导致扫码死循环

- **原版问题**：`startQrCode()` 无条件检查 `READ_EXTERNAL_STORAGE`。
  该权限在 **Android 13（API 33）已被系统废弃**，申请后系统直接返回拒绝。
- **后果**：Android 13+ 用户点击“扫码配置” → 申请秒拒 → 弹提示 → 循环卡死，
  **完全无法使用扫码配置**。
- **修复**：
  - Android 13+ 不再申请该废弃权限，直接进入扫码页
    （相册选图走系统选择器自带授权，保存图片走 MediaStore 免权限）；
  - Android 12L 及以下保持原有申请逻辑；
  - 权限被拒提示从 Toast 升级为**弹窗 + 「去开启」直达系统设置页**。

### 8. 自启动权限永久误报

- **原版问题**：`PermissionGuideHelper` 将自启动项硬编码为“未授权”。
- **后果**：国产 ROM 的自启动开关是厂商私有设置，Android **没有公开 API 可读取其状态**，
  用户即使已开启也永远提示缺失。
- **修复**：改为“引导确认”机制 —— 用户访问过自启动设置页后标记为已确认，
  不再重复报缺失。

### 9. 打赏保存收款码功能静默失效

- **原版问题**：与问题 7 同源 —— Android 10+ 分支反而检查已废弃的
  `WRITE_EXTERNAL_STORAGE`，检查不通过后流程中断。
- **修复**：Android 10+ 直接使用 MediaStore 保存（免权限），Android 9 及以下保留原申请逻辑。

### 10. 字符串引用比较

- **原版问题**：`host != "" && key != ""` 比较的是**对象引用**而非内容。
- **修复**：改用 `TextUtils.isEmpty()`。

### 11. 退出流程反射调用失效

- **原版问题**：`exitApp()` 通过反射调用 `releaseWakeLock`，
  但该方法为**实例方法**却以 `invoke(null)` 调用，必然抛出异常（被 catch 吞掉）。
- **修复**：改为直接 `stopService()` 触发监听服务的 `onDestroy()`
  （该生命周期已实现心跳线程中断 + WakeLock 释放）。

---

## 二、🌐 网络层重构（新增 `NetworkClient`）

原版网络请求**硬编码 `http://` 单协议、零重试**，在移动网络下极易失败(特别是未备案域名)。

| 能力 | 原版 | 本优化版 |
|:---|:---|:---|
| 协议 | 硬编码 `http://` 单协议 | **https / http 交替重试** |
| 重试策略 | **无**（一次失败即判定错误） | **6 次重试 + 递增退避** |
| 308 重定向 | 不跟随 | **自动跟随**（`followSslRedirects`） |
| DNS 解析 | 明文 UDP（可被污染） | **阿里 DoH 加密解析** + 系统 DNS 降级 |
| IP 直连 | 不支持 | **支持**（`IP` / `IP:端口`，自动 http 优先） |
| 连接管理 | 每次新建 | 单例复用 + `Connection: close` 防半死连接 |

**设计要点**：

- IP 直连模式自动全部走 `http`（`https + IP` 无匹配证书必然失败，避免无效尝试）；
- 域名模式自动 `https` 优先，并跟随服务端 308 跳转；
- DoH 失败自动降级系统 DNS，保证可用性；
- 统一入口：异步 `getWithRetry()` / 同步 `getWithRetrySync()`。

**实测效果**（联通移动网络，同网络路径）：

| 场景 | 原版 | 优化版 |
|:---|:---:|:---:|
| 域名被 SNI 阻断环境下 | **0/10 成功** | 12/12 成功（IP 直连通道） |

---

## 三、🔐 权限引导体系（新增 `PermissionGuideHelper`）

| 场景 | 原版 | 本优化版 |
|:---|:---|:---|
| 首次打开 | 仅检查通知权限，**Toast 文字提示** | **弹窗列出全部缺失项** |
| 用户操作 | 自行到系统设置中翻找 | 点击「去开启」**直达对应设置页** |
| 覆盖权限 | 1 项（通知使用权） | **5 项**（通知使用权 / 电池白名单 / 通知栏 / 存储 / 自启动） |
| 授权反馈 | 无 | 返回后自动复查，全部就绪提示 ✓ |
| 厂商适配 | 无 | **内置 11 个厂商自启动页**（小米 / 华为 / OPPO / vivo / 三星） |
| 手动入口 | 无 | 菜单「权限检查」 |

所有跳转均带三级回退（专用设置页 → 备用页 → 应用详情页），不会因机型差异崩溃。

---

## 四、⚡ 稳定性与资源管理

| 项 | 原版 | 本优化版 |
|:---|:---|:---|
| 心跳线程生命周期 | 裸线程，Service 销毁不回收 | 绑定 Service，`onDestroy` 中断 |
| WakeLock | **无限期持有**（异常时设备永不休眠，耗电剧增） | **6 分钟超时自动释放** |
| 日志存储 | `commit()` 同步磁盘 IO | `apply()` 异步写入 |
| 进程模型 | 1 主 + 5 子（内存 ×6，查杀面大） | **单进程** |
| 崩溃恢复 | 僵尸进程 | 记录后正常崩溃，前台服务自动重启 |

### 多进程收敛（重要）

原版在 Manifest 中声明了 5 个独立进程：

```
:daemon_service  :service  :music_service  :native_daemon  :sync_adapter
```

每个子进程都会**完整加载一套 ART 虚拟机与应用类**，内存占用 ×6，
且为厂商 ROM 提供了更多查杀入口，**反而降低整体存活率**。

本版已移除全部 `android:process` 声明，收敛为单进程。

---

## 五、🧹 死代码清理（删除 12 个文件，约 1600 行）

| 删除项 | 删除理由 |
|:---|:---|
| `NativeDaemonService` | 需 Root 执行 shell 命令，普通设备必然失败 |
| `SyncAdapterService` + `SyncAdapter` + `AccountAuthService` + `AccountAuthenticatorService` + `SyncProvider` + `SyncManager` + 2 个 XML | Account Sync 保活在 Android 8+ 现代 ROM 已全面失效 |
| `AliveJobService` | JobScheduler 短周期轮询在 Android 8+ 被限制到 15 分钟起，失去保活意义 |
| `JobSchedulerManager` | 持有 `static Context`，内存泄漏典型 |
| `SinglePixelActivity` + `ScreenManager` + `ScreenReceiverUtil` | 1 像素保活方案自 2017 年后已被各 ROM 识别并封杀 |
| Manifest 中对应声明（4 服务 + 1 Provider） | 同上 |

> 保留的保活手段仅剩**真正有效**的组合：
> 前台服务 + 电池优化白名单 + 通知使用权 + （可选）音频保活。

---

## 六、🛡️ 安全加固

| 项 | 原版 | 本优化版 |
|:---|:---|:---|
| 版本更新检查 | `http://` 明文（存在被中间人劫持推送恶意安装包的风险） | **`https://`** |
| 调试日志 | `DEBUG = true` 硬编码，release 包也全量输出（含 host、收款金额等敏感信息） | **绑定 `BuildConfig.DEBUG`**，release 自动静默 |

---

## 七、📦 构建与部署改进

| 项 | 原版 | 本优化版 |
|:---|:---|:---|
| 依赖仓库 | 仅 google / mavenCentral（国内直连不稳定） | **优先国内镜像**（腾讯 / 阿里），官方源回退 |
| AGP 8 兼容 | 未显式开启 BuildConfig | `buildFeatures { buildConfig true }` |
| 服务端接入 | 仅域名通道 | **双通道**：域名 + 裸 IP 端口（绕开 SNI 阻断） |

> 裸 IP 端口通道仅暴露 API 接口（心跳 / 推送 / 下单），**不暴露管理后台**，
> 降低被端口扫描探测到后台登录入口的风险。

---

## 九、🔀 双通道自动健康检查与故障切换（新增 `ChannelManager`）

在双通道网络层（域名 + 裸 IP）基础上，进一步支持**可选的备用服务器通道**：
主通道连续失败达到阈值时自动切换到备用通道，主通道恢复后自动回切（迟滞避免抖动）。

| 项 | 说明 |
|:---|:---|
| 配置 | 新增可选 `host2`/`key2`（格式同主通道，留空退化为单通道，**完全向后兼容**） |
| 切换 | 主通道连续失败 3 次且有备用 → 切备用；主通道健康 3 次 → 回切主（hysteresis） |
| 持久化 | 通道选择 + 失败/健康计数存入 `shinian` SP，重启后延续 |
| 记账 | 心跳 / 收款回调 / 补单 / 手动检测全量接入 `ChannelManager` 记账 |
| 签名 | 切换通道时 sign 用对应 key 重新计算（`md5(t + activeKey)`），避免跨通道验签失败 |
| UI | 主界面新增「备用通道配置」按钮 + 当前通道状态显示 |
| 线程安全 | 全部状态变更在 `synchronized` 锁内进行 |

> ⚠️ 旧用户/未配置 `host2` 时行为与改造前完全一致（恒用主通道），不影响现有收款链路。

---

## 十、🧪 单元测试补充（`app/src/test`）

| 测试类 | 用例数 | 覆盖 |
|:---|:---:|:---|
| `PayNotificationParserTest` | 57 | 微信/支付宝各类通知文案→金额解析（含边界/易错用例），参数化 |
| `ChannelManagerTest` | 4 | 双通道故障切换状态机参数/约束/方法签名回归 |
总计 **61 个用例全部通过（0 failures / 0 errors）**，CI 可直接 `:app:testDebugUnitTest` 验证。

---


## 十一、许可证与致谢

本项目基于 [shinian-a/Vmq-App](https://github.com/shinian-a/Vmq-App) 二次开发。

- 原项目版权归原作者 **shinian-a** 所有
- 遵循 **Apache License 2.0** 开源协议发布
- 修改内容同样以 **Apache License 2.0** 发布
- 详细许可条款见项目根目录 [LICENSE](LICENSE) 文件

感谢原作者的开源贡献。如本项目对你有帮助，也请给[原项目](https://github.com/shinian-a/Vmq-App)一个 Star ⭐。

---

## 十二、🧱 全量 Kotlin 化重构

业务包 `com.shinian` 已从 Java **100% 迁移到 Kotlin**（Kotlin 2.3.10 + Coroutines 1.9.0），
分 6 个阶段推进，每阶段均通过编译与单测验证：

| 阶段 | 内容 |
|:---|:---|
| S0 | 启用 Kotlin 工具链（AGP 8.12 + KGP 2.3.10 + kotlinx-coroutines） |
| S1 | 叶子类迁移：`NetworkClient` / `ChannelManager` / `AppConstants` / `SystemUtils` / `BitmapUtil` / `SaveImageUtils` / `AlertDialogUtil` / `HelpActivity` |
| S2 | 抽取收款金额解析为独立 `MoneyParser`（纯 JVM 逻辑，无 Android 依赖） |
| S3 | `VmqApplication` / 小 Activity / Service 层（`DaemonService` / `ForeService` / `CancelNoticeService` / `PlayerMusicService`） |
| S4 | 收款链路核心 `PayNotificationListenerService` |
| S5 | `MainActivity`(1930 行) / `SettingActivity`(525 行) / `PermissionGuideHelper`(367 行) |

**兼容性保障**：

- 工具类统一用 `object` + `@JvmStatic`（常量 `@JvmField`/`const`），Java 调用点语法不变；
- 布局/菜单 `android:onClick` 反射绑定、`LogsTextView`/`monitorLogHandler`/`getHttpURLConnection` 静态契约保持不变；
- 清单类名与组件声明不变，旧配置数据（`shinian` SP）完全兼容。
> ⚠️ 说明：本环境可验证「编译 + JVM 单测 + 打包」，运行时行为（通知监听 / 相机 / 服务生命周期 / 收款回调）需真机回归验证。

---

## 十三、🎨 UI 全量重构（设计系统 + 卡片式布局）

建立统一的设计系统，并将全部页面改写为卡片式 Material 风格。

**设计系统（新增/重写）**：

| 文件 | 内容 |
|:---|:---|
| `values/colors.xml` | 品牌色（蓝 `#1A73E8` + 青绿 `#00BFA5`）、语义色（成功/警告/错误/信息）、中性色阶、日志终端配色 |
| `values/dimens.xml` | 8dp 栅格间距、圆角、组件尺寸、字号、阴影 —— 消除散落的魔法数字 |
| `values/styles.xml` | `Text.*`（Display/Title/Subtitle/Body/Caption/SectionLabel）、`Card`、`Button.Primary/Secondary`、`SettingRow.*`、`Toolbar.Title` |
| `drawable/`（10 个新增） | `bg_card`、`bg_button_primary`、`bg_button_secondary`、`bg_setting_row`、`bg_log`、`bg_toolbar`、`bg_info_panel`、`bg_icon_circle`、`bg_badge_success/neutral`、`ic_arrow_back`（矢量） |

**页面重构**：

| 页面 | 改动 |
|:---|:---|
| 主界面 | 配置信息卡 / 快捷操作卡 / 监控日志卡三段式；按钮高度 42dp→48dp（达标最小触控）；日志区改为深色终端风圆角面板 |
| 设置页 | 分组卡片 + 64dp 列表行 + 右侧箭头；分区标题（版本/反馈/帮助/服务/其他） |
| 关于页 | 图标头卡 + 简介卡 + 功能入口卡 |
| 帮助页 | 步骤卡片化；图片改为 `match_parent` + `adjustViewBounds`（原 `wrap_content` + 固定 px，小屏会溢出） |

**兼容性保障**：

- 所有 `android:id`、`android:onClick` 逐一保留，Java/Kotlin 绑定零改动；
- 保留 zxing 依赖的 `ripple.xml`、`ViewfinderView` 属性与 `toolbar_scanner.xml`；
- 保留旧主题别名 `HideStyle` 与 `activity_horizontal_margin` 等旧维度引用。

> ⚠️ 主题由 `Light.DarkActionBar` 改为 `NoActionBar` 后，主界面改用布局内 `Toolbar` 承载溢出菜单，
> 通过 `setSupportActionBar()` 接入，菜单项（群聊/分享/打赏/关于/权限检查/设置/退出）功能不变。

---

## 十四、🔗 更新源与仓库链接切换为当前仓库

原实现的「检查更新」指向第三方私有接口（`w.t3yanzheng.com`，`POST ver=xxx` + 自定义 JSON），
与 GitHub 托管方式不兼容，已整体替换。

| 项 | 原 | 现 |
|:---|:---|:---|
| 更新检查 | 第三方私有接口（明文 http / https 混用） | **本仓库 GitHub Releases API**（`api.github.com/repos/Nanying666/Vmq-App-Optimized/releases/latest`） |
| 版本比较 | 服务端返回 `version` 字段 | release `tag_name` 与本地 versionName **逐段数值比较** |
| 更新说明 | 服务端 `uplog` | release `body` |
| 下载地址 | 服务端 `upurl` | release 内首个 `.apk` 资产（无资产则回退 release 页面） |
| 关于页 GitHub 链接 | `github.com/shinian-a/Vmq-App` | `github.com/Nanying666/Vmq-App-Optimized` |
| 问题反馈链接 | `.../shinian-a/Vmq-App/issues` | `.../Nanying666/Vmq-App-Optimized/issues` |
| 分享文案链接 | `shinian-a.github.io` | 当前仓库地址 |

**实现**：新增 `util/UpdateChecker.kt`，将重复的更新检查逻辑从 `MainActivity` 与 `SettingActivity` 中抽出统一维护；
GitHub API 强制要求 `User-Agent`，已显式设置；未鉴权限流 60 次/小时/IP，失败时静默降级为"已是最新"。

> ⚠️ 原第三方接口依赖服务端契约，若你的服务端仍在使用该接口，请自行保留原逻辑或另建更新源。

---

## 十五、🐛 全量问题修复与工程优化

基于对全部源码/资源的系统性审查，修复以下问题。

### 🔴 功能性缺陷（会崩溃或功能失效）

| # | 问题 | 影响 | 修复 |
|:--|:--|:--|:--|
| 1 | `AndroidManifest.xml` 仍声明已删除的 `.ui.SinglePixelActivity` | 系统实例化时 `ClassNotFoundException` | 删除该 `<activity>` 声明 |
| 2 | `DaemonService` / `CancelNoticeService` 的 `startForeground()` **只传 2 个参数**，但 Manifest 声明了 `foregroundServiceType="dataSync"` | **Android 14 上抛 `MissingForegroundServiceTypeException`，保活链路直接失效** | 改用三参重载并传入 `FOREGROUND_SERVICE_TYPE_DATA_SYNC`（API 31+） |
| 3 | `CaptureActivity.scanningImage()` 未判空即 `new RGBLuminanceSource(scanBitmap)` | 相册选到非图片/损坏图 → **NPE 崩溃** | 加 null 检查 + 构造异常兜底 |
| 4 | 设置页用 `Switch.hint` 显示"开启/关闭" | `hint` 对 Switch **不生效**，状态文案从未显示；且回读语义与存储值相反 | 新增独立状态 `TextView`（`txt_always_on_state`）+ 抽取 `STATE_ON/STATE_OFF` 常量 |

### 🟠 体积与依赖（APK 减少 1.34 MB）

`app/libs/` 原有 7 个 jar，业务代码**零引用**其中 6 个，但全部被打进 APK：

| 删除的 jar | 体积 | 原用途 |
|:--|--:|:--|
| `mail.jar` | 432 KB | JavaMail（未使用） |
| `open_sdk_*.jar` | 344 KB | QQ SDK（未使用） |
| `mta-sdk-2.0.0.jar` | 112 KB | 腾讯统计（未使用） |
| `activation.jar` | 52 KB | JavaMail 依赖 |
| `additionnal.jar` | 48 KB | JavaMail 依赖 |
| `mid-sdk-2.10.jar` | 44 KB | 腾讯 MID（未使用） |

- `core_3.0.1.jar`（zxing 核心）**改用 Maven 依赖** `com.google.zxing:core:3.5.3`，R8 可裁剪未使用的条码格式。
- `app/libs/` 现已清空，移除冗余的 `fileTree` 依赖声明。

> 实测 APK：**8.93 MB → 7.66 MB（−15%）**，且 APK 内 `javax/mail`、`com/tencent/stat`、`com/tencent/mid`、`com/tencent/connect` 符号**全部归零**。

### 🟠 代码质量

| 问题 | 修复 |
|:--|:--|
| `md5()` 在 `PayNotificationListenerService` 与 `MainActivity` 中**各有一份逐字符相同**的实现（签名逻辑分叉风险） | 抽出统一 `util/Md5.hex()`，两处委托调用 |
| `SystemUtils` / `QrCodeGenerator` / `EncodingHandler` / `util/BitmapUtil` 均为死代码（0 引用） | 删除 4 个文件 |
| Manifest 声明 6 项无引用权限（Account Sync 全家 + `RECEIVE_BOOT_COMPLETED`） | 删除，减少应用商店审核质疑 |
| `strings.xml` 中 `skm`/`WeChat`/`FeedActivity`/`WxPayActivity`/`wxpay_ts` 等 0 引用 | 删除 |

### 🟡 安全与工程配置

| 项 | 原 | 现 |
|:--|:--|:--|
| `allowBackup` | `true` —— `shinian` SP（含 **host 与通讯密钥**）会进入云备份 / `adb backup` | `false` + 新增 `data_extraction_rules.xml` 显式排除 |
| `android.enableJetifier` | `true`（已全量 AndroidX，无 support 库） | `false`，缩短构建时间 |
| `proguard-rules.pro` | `-keep class okhttp3.** { *; }` 全量保留，R8 无法裁剪 | 收紧为按需保留；补 `SourceFile,LineNumberTable` 便于线上崩溃定位 |

> ✅ 混淆安全已验证：`android:onClick` 由 AGP 自动生成 keep 规则（`aapt_rules.txt` 内 17 条）；
> 收紧规则后 `minifyReleaseWithR8` 通过且无 Missing class 警告，反射依赖的类名与方法名均正确保留。

---

## 十六、📱 真机实测问题修复

以下问题来自**真机运行反馈**（非静态分析），均已定位根因并修复。

### 🔴 1. 同一笔收款被重复回调（会导致重复入账）

**现象**：日志中出现两条时间相同、内容完全一致的"监听到微信支付收款 1.80 元 通知回调状态：成功"。

**根因**：微信/支付宝在收款后会对**同一条通知**多次更新（弹出动画、内容补充等），
每次更新系统都会回调 `onNotificationPosted`，旧实现未做去重，于是同一笔收款被回调服务端两次。

**修复**：新增 `util/NotificationDeduper`，以「通知 `key` + 内容指纹」为键做**双重判定**：

| 条件 | 说明 |
|:--|:--|
| 内容指纹相同 | 同一笔收款的文案不会变化 |
| 落在 10 秒窗口内 | 重复通知通常在数秒内到达 |

两个条件**同时满足**才判为重复 —— 避免误杀真实的多笔收款（如连续两笔 1.80 元）。
附带惰性清理，记录数不会无限增长。

> 已补 **8 条单元测试**覆盖边界：窗口内/外、相同文案不同 key、相同 key 不同金额、边界值、容量上限、清空重置。

### 🔴 2. 通知栏常驻通知会消失（后台不常驻）

**现象**："通知栏服务正在后台运行中"久了会消失，收款监听随之失效。

**根因**：`ForeService` 无自愈机制，且 `MainActivity.onCreate` **只启动一次** ——
进程被系统回收后，通知消失且再无拉起入口。

**修复**（三重保障）：

| 机制 | 说明 |
|:--|:--|
| `ForeService.onDestroy` 自愈 | 非用户主动退出时立即重新 `startForegroundService` |
| `MainActivity.onResume` 兜底 | 每次回到前台都确保服务在运行（幂等） |
| `START_STICKY` | 被系统杀死后由系统自动重建 |

### 🟠 3. 顶栏标题重复显示两遍

**现象**：顶栏显示"V免签监控端_Pro V免签监控端_Pro"。

**根因**：`setSupportActionBar(toolbar)` 会把 Activity 的 `android:label` 作为 ActionBar 标题，
而布局内 Toolbar 已自带标题 `TextView`，两者叠加。

**修复**：`supportActionBar?.setDisplayShowTitleEnabled(false)`。

### 🟠 4. 监听日志重复刷屏

**现象**：日志中"监听服务开启成功！"连续出现多条。

**根因**：系统在服务重连时会多次回调 `onListenerConnected`。

**修复**：加 5 秒去重窗口，窗口内重入只记录调试日志、不再重复写入监控日志。

### 🟠 5. 退出 APP 后残留通知/音频

**根因**：`exitApp()` 只停了 `ForeService` 与监听服务，**遗漏** `DaemonService` 与 `PlayerMusicService`。

**修复**：补上两者的 `stopService`，退出更干净。

---