# Vmq-App - 免 Root 收款监听助手

> ## 🔧 本仓库说明：优化修复版（衍生作品）
>
> 本仓库基于原版 [shinian-a/Vmq-App](https://github.com/shinian-a/Vmq-App) 二次开发，
> 聚焦于**修复功能性 Bug、重构网络层、完善权限引导、清理死代码**。
>
> **相对原版的主要改进**：
>
> | 类别 | 改进要点 |
> |:---|:---|
> | 🔴 功能修复 | 修复 **11 个功能性 Bug**，含「自动补单从未成功」「心跳一次异常永久停跳」「崩溃后僵尸进程」等 |
> | 🌐 网络层 | 新增统一网络客户端：https/http 交替重试、DoH 加密 DNS、支持 IP 直连 |
> | 🔐 权限引导 | 首次打开弹窗列出缺失权限，点击直达系统设置页（覆盖 5 项权限 + 11 个厂商适配） |
> | ⚡ 稳定性 | 单进程化（原 6 进程）、WakeLock 超时释放、消除多处资源泄漏 |
> | 🧹 代码清理 | 删除 12 个失效保活文件（约 1600 行），保留真正有效的保活组合 |
> | 🛡️ 安全 | 更新检查切 HTTPS、release 包自动关闭调试日志 |
> | 🔀 双通道 | 可选备用服务器通道，主通道连续失败自动切换、恢复自动回切（迟滞防抖） |
> | 🧪 单元测试 | 通知解析 / 金额解析 / 双通道状态机，共 **77 个 JVM 用例** |
> | 🧱 Kotlin 化 | 业务包 `com.shinian` **100% Kotlin**（Kotlin 2.3.10 + Coroutines） |
> | 🎨 UI 重构 | 建立设计系统（色板/间距/样式），全部页面改为卡片式 Material 风格 |
>
> 📄 **完整对比说明请见 [CHANGELOG.md](CHANGELOG.md)**
>
> 本衍生作品遵循原项目 **Apache License 2.0** 协议发布，
> 原作版权归 **shinian-a** 所有，详见 [LICENSE](LICENSE) 与 [NOTICE](NOTICE)。
>
> ---

## 📥 下载安装

| 项目 | 值 |
|:---|:---|
| **APK 下载** | [**Vmq-App-Optimized-v3.0-debug.apk**](https://github.com/Nanying666/Vmq-App-Optimized/releases/latest/download/Vmq-App-Optimized-v3.0-debug.apk) |
| 版本 | versionName **3.0** / versionCode **13** |
| 包名 | `com.shinian.pay` |
| 体积 | 7.66 MB |
| 签名 | Debug 签名 |
| SHA-256 | `39cf921f44d071241575c5a54f117d3fe718f072efca53c6068cdde3828012bb` |

> ⚠️ **安装说明**
> - 本 APK 为 **Debug 签名**（原版 release 密钥存放在原作者的 GitHub Actions secrets 中，无法获取）。
> - 若手机已安装原版 **release 包**，因签名不同**需先卸载**再安装。
> - 首次启动会弹出**权限引导弹窗**，请按提示逐项授权。
> - 安装后需在 APP 内配置你的服务器地址与密钥，再点「检测心跳」验证连通。
> - 「软件设置 → 检测更新」会从本仓库 GitHub Releases 检查新版本。
>
> 完整修复/优化清单见 [CHANGELOG.md](CHANGELOG.md)，历史版本见 [Releases](https://github.com/Nanying666/Vmq-App-Optimized/releases)。

## 📱 项目简介

这是一款基于V 免签开发的 Android 收款监听应用，**无需 Root 权限和框架**即可实现支付宝和微信收款消息的自动监听与回调。

## PC监控端下载：[PC_Vmq_Pro_Server](https://shinian-a.github.io/) PC端新增自定义监听回调数据，支持任意编程语言接入收款

## [推荐项目EgoPay](https://shinian-a.github.io/post/EgoPay-yi-zhi-fu-wang-zhan.html)

APP已更新完整分支

### ✨ 核心功能

- 🎯 **双平台监听**：支持支付宝和微信收款通知监听
- 🔔 **智能回调**：匹配服务端订单金额后自动触发回调
- 📊 **日志面板**：实时查看监听日志和回调记录
- 👥 **店员管理**：支持店员监听功能
- 🔋 **持久运行**：电池白名单保护，后台稳定运行
- ⚡ **性能优化**：精简代码结构，启动速度提升

### 🛠️ 版本改进

相比原版的主要改进：
- ✅ 修复支付宝和微信不回调的 BUG
- ✅ 优化代码结构，提升执行效率
- ✅ 增加电池白名单权限，防止被系统杀掉进程
- ✅ 增加日志监听

#### 有任何建议欢迎致信我，如果可能的话可增加功能，如果本项目对您有帮助请给我一个免费的Star⭐

## 🏗️ 技术架构

- **开发语言**：Java + XML + Gradle
- **目标平台**：Android 7.0+ (API 21)
- **编译 SDK**：Android 36（已优化兼容性）
- **构建工具**：Gradle 9.1.0
- **开发环境**：Android Studio / AIDE

### 📱 设备兼容性说明

#### ✅ 已测试支持的设备

- 小米/Redmi 系列（MIUI 12-14）（实现
- 华为/荣耀系列（实现
- OPPO/Vivo 系列（未实现
- 三星系列（未实现
- Google Pixel 系列

## 📥 安装使用

### 方式一：直接安装（推荐）

从 [Releases](https://github.com/shinian-a/Vmq-App/releases) 下载最新 APK 安装包，完成以下操作：

1. 安装 APK 到 Android 设备
2. 授予必要的权限（通知读取、自启动等）
3. 配置服务端信息
4. 保持应用在前台或后台运行

### 方式二：源码构建

#### IntelliJ IDEA 构建
```code
# 克隆项目到本地
git clone https://github.com/shinian-a/Vmq-App.git

# 使用 IntelliJ IDEA 打开项目(请提前安装Android插件)
# 等待 Gradle 同步完成
# 点击 Build → Build Bundle(s) / APK(s) → Build APK(s)
```

#### Activity(历史)

你可以使用Activity查阅所有时间段源码构建详细过程

## 💾 下载镜像

| 镜像源             | 链接                                                    | 备注         |
|-----------------|-------------------------------------------------------|------------|
| GitHub Releases | [下载地址](https://github.com/shinian-a/Vmq-App/releases) | 官方最新版      |
| 蓝奏云             | [下载地址](https://shinianacn.lanzouy.com/b027kqata)      | 密码：vmq(停滞) |
| Gitee           | [下载地址](https://gitee.com/shinian-a/Vmq-App/releases)  | 国内镜像(停滞)   |

## ⚙️ 使用说明

### 必要配置

1. **微信配置**
   - 关注公众号"微信支付"和"微信收款助手"
   - 开启微信收款通知权限

2. **支付宝配置**
   - 开启支付宝收款通知权限

3. **系统权限**（强烈推荐）
   - ✅ 开启**电池白名单**权限
   - ✅ 允许**自启动**和**后台运行**
   - ✅ 授予**通知读取**权限
   - 📱 具体方法请百度您手机品牌的设置教程

### 运行模式

应用支持以下运行方式（需满足上述权限）：
- 📱 前台运行
- 🔄 后台运行
- 🌙 息屏后台运行


### 故障排查

如遇问题，请按以下步骤检查：
1. 确认已授予所有必要权限
2. 检查电池白名单是否开启
3. 确认应用处于运行状态（前台/后台）
4. 查看日志面板确认回调状态
5. 升级到最新版本
6. 开启软件自启动

## 📬 联系与支持

### 联系方式
- 📧 邮箱：[shiniana@qq.com](mailto:shiniana@qq.com)
- 💡 如有任何建议或遇到问题，欢迎致信交流
- 反馈请建立 issue

### 致谢
本项目基于 [V免签](https://github.com/szvone/Vmq) 开发，感谢原作者的贡献。

---

**如果这个项目对您有帮助，请给一个免费的 Star⭐！**
