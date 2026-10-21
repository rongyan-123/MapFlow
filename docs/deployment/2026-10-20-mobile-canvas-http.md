# 手机画布发布与 HTTP 转发状态

2026-10-21：前端已发布；用户在平台开通 HTTP 隧道并提供分配名称后，12:30:33（北京时间）完成真实接入。公网 HTTP 已返回保留原路径与查询的 308，HTTPS 正常，独立转发服务已启用自动启动。见 [正式发布](../research/2026-10-21-mobile-ui-deployment.md)。

## 本次真实注册结果

北京时间 01:10 的首次尝试中，独立 frpc 登录成功，但代理返回“未找到代理 mapflow-http-redirect 的活跃隧道”。当时新服务已停止并禁用，原 SSH／HTTPS 没有改变。随后用户正式开通 HTTP 隧道，提供平台生成的准确名称；12:30 使用该名称连接成功。名称不可自行改成显示用名称，实际值只保存在私有配置和验收记录中。

已开通参数：域名 `xxian.fun`，类型 HTTP，本地地址 `127.0.0.1`、端口 `18090`，不启用 PROXY 协议，保留加密与压缩。首次连接和只重启新增服务后的 GET／HEAD、深路径、编码路径及查询均返回 308；HTTPS readiness 为 200。Windows 独立无代理请求也仅跳转一次到原路径的 HTTPS，并返回 200。

`mapflow-http-redirect.service` 为 active／enabled，用户管理器 Linger=yes；本轮未实际重启宿主机。原 `frpc.toml` 摘要及原 frpc 的 PID／启动时间不变，应用、数据库、知识服务和 Caddy 均未重启。私有证据位于宿主 `releases/20261021-mobile-ui/http-registered-provider-20261021/verified.json`。

## 已核对的入口

- 修复前的公网 HTTP 404 来自 FRP；当前已转给本地 Caddy 返回 308。
- 宿主 Caddy 的 `127.0.0.1:18090` 已将 `Host: xxian.fun` 的请求以 308 跳转到相同 HTTPS 路径，查询参数保留。
- 原 `/home/rong/.config/frp/frpc.toml` 继续只保留 SSH 和 HTTPS；HTTP 使用独立的 `mapflow-http-redirect.toml` 与用户服务。
- 现有 HTTPS 指向 18443，并启用 PROXY v2。HTTP 应指向 18090，不发送此头；Caddy 的 80 端口不接受 HTTPS 端口使用的这一封装。

## 候选配置

使用 [准备脚本](../../scripts/prepare_http_redirect.py) 从当前配置生成独立候选。将下方 `PROVIDER_ASSIGNED_TUNNEL_NAME` 替换为平台下发的原始名称，不可自行重命名：

```sh
python3 /path/to/prepare_http_redirect.py \
  --source /home/rong/.config/frp/frpc.toml \
  --output /home/rong/.config/frp/mapflow-http-redirect.toml \
  --proxy-name PROVIDER_ASSIGNED_TUNNEL_NAME

/home/rong/.local/opt/frp/frp_0.64.0_linux_amd64/frpc verify \
  -c /home/rong/.config/frp/mapflow-http-redirect.toml
```

脚本要求显式提供平台名称，复制原连接身份、认证和公共传输配置，只生成一条 HTTP 代理，不复制 SSH／HTTPS 代理或管理端口。候选包含私有身份信息，以 0600 权限新建；已存在目标直接拒绝，不覆盖原配置、不启动服务、不将真实配置提交 Git。正式配置已经存在，不要直接重复运行示例命令覆盖它。

10 月 20 日的准备阶段验证过候选语法及拒绝覆盖，但未注册公网路由。10 月 21 日接入补充两项先红后绿的测试，确保准确保留平台名称、缺少名称时不生成配置；Python 完整脚本测试 18 项通过。当前真实启用结果见本页首段。

## 正式登记后启用

独立用户服务建议为 `~/.config/systemd/user/mapflow-http-redirect.service`：

```ini
[Unit]
Description=MapFlow HTTP to HTTPS route
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
ExecStart=/home/rong/.local/opt/frp/frp_0.64.0_linux_amd64/frpc -c /home/rong/.config/frp/mapflow-http-redirect.toml
Restart=on-failure
RestartSec=10
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=read-only
PrivateTmp=true

[Install]
WantedBy=default.target
```

启用前重读宿主 OPERATIONS 和本次批准范围。先核对已有映射、保存当前配置和摘要，再生成候选并校验；不重启原 frpc、HTTPS、SSH 或应用。只启动新的 HTTP 服务，确认供应商接受该域名路由后再启用自动启动。

如服务商要求控制台登记，或日志报告权限、名称或域名冲突，停止新服务并重新核对，不修改原路由或尝试绕过限制。配置语法通过不能替代真实注册验收。

## 公网验收与回退

- 无代理独立请求 `http://xxian.fun/`、`http://xxian.fun/learning?area=...` 和带编码查询的路径；均须返回 308，Location 指向原路径与查询对应的 HTTPS 地址。
- HTTPS 首页和 readiness 仍为 200，原 SSH、收款与知识服务保持可达。
- 只重启新 HTTP 服务，重复公网验证；不通过就停止并禁用该服务，恢复 HTTP 改动前的状态。原 FRP 和 Caddy 无须回退，因为没有改动。
- 应用前端发布继续遵守“有活动聊天就跳过”的条件；HTTP 候选准备与前端发布是两项独立操作。
