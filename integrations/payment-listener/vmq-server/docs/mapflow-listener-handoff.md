# Vmq 与 MapFlow 的接入合同

更新：2026-10-18。源码已在 main，当前运行入口见[生产与收款说明](../../../../docs/workflow/production.md)。2026-09/10 初期 Linux 安卓实验和旧验收数据保留于 [Git 历史版本](https://github.com/rongyan-123/MapFlow/blob/5e962568c15e4da411d8054c662317cbeb861720/integrations/payment-listener/vmq-server/docs/mapflow-listener-handoff.md)，不作为当前部署指令。

## 通路

Windows MuMu 内通知监听端 → ADB reverse 28080 → Windows 本地 SSH 转发 → Linux Vmq → MapFlow 回调 → 额度账本。

MapFlow-Vmq-Relay 自动启动 D:/MapFlow-operations/vmq-relay/Connect-Vmq.ps1。Vmq 在 Linux 的 127.0.0.1:28080，网站私有回调为 GET /api/wallet/payments/vmq/notify。密钥和账号资料不放入文档或源码。SSH 转发是连接工具，不能单凭任务 Running 认定模拟器心跳或付款成功。

## 通知与订单匹配

安卓 /appPush 请求包含 type、price、t 及 sign=MD5(type+price+t+通讯密钥)。渠道和金额只匹配唯一有效订单；重复、无匹配、多匹配或近期相同金额的通知按服务端规则拒绝重放或保留待核实。保留通知原时间，不把过旧通知伪装成新收款。该通知来自监听程序，不能替代支付账户真实流水。

MapFlow 创建订单时以充值申请 UUID 作为 payId。Vmq 回调发送 payId、param、type、price、reallyPrice、sign；签名为 MD5(payId+param+type+price+reallyPrice+通讯密钥)。后端从自身数据库取申请并独立查询 Vmq 已付订单，检查渠道、申请金额、实际金额、订单标识及付款有效期。

符合条件的回调在同一数据库事务中锁定申请并写订单、余额、唯一流水、事件和审计；已经入账或撤销的记录不能再次加钱。用户声明未付款、无效状态或参数冲突会拒绝自动入账。无法归属的实际收款由管理员核对流水后处理；用户“已付款”声明、任意 URL 账号或待核实收款均不能直接加额度。具体实现以 mapflow-server 的 src/http/wallet.rs、src/vmq.rs 和 src/adapters/postgres/wallet_store.rs 为准。

## 本轮验证边界

2026-10-18 只迁移 Windows 自动启动入口，保持脚本字节内容、任务触发器、身份、重试设置和安全权限；两次受控新启动均验证独立 SSH 监听、HTTP 200、MuMu 在线与 ADB reverse。没有重启登录系统，也未提交新的真实付款或伪造回调；旧脚本、任务 XML 与回滚资料已保留。历史自动充值、金额不匹配及人工入账记录见主仓库发布资料，不能把早期实验结论当作当前接口尚未实现。

## 修改与构建

服务端使用 Maven：mvn test、mvn package；产物 target/mq-0.0.1-SNAPSHOT.war。安卓端在相邻 android-monitor/ 按自身 README 构建。生产密钥、H2 数据、管理密码和账号状态单独备份；管理面只允许受控访问。迁移设备必须重新验证权限、后台通知、心跳和实际订单，不用编译通过替代收款验收。
