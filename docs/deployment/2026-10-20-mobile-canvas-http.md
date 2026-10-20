# 手机画布发布与 HTTP 转发状态

2026-10-21：用户验收后已发布前端，见 [正式发布](../research/2026-10-21-mobile-ui-deployment.md)。HTTP 候选通过语法检查；真实注册被服务商拒绝，新增服务已停止并禁用，公网 HTTP 仍为 404。下面保留配置与验收要求，不代表跳转已上线。

## 本次真实注册结果

北京时间 01:10，独立 frpc 成功登录服务端，随后 HTTP 代理返回“未找到代理 mapflow-http-redirect 的活跃隧道”。这是服务商未登记对应隧道，Caddy 本地跳转配置并非此次失败原因。已停止并禁用新建的 `mapflow-http-redirect.service`，原 `frpc.toml` 摘要一致，原 SSH／HTTPS 服务未重启。HTTPS readiness 保持 200。

继续处理需取得服务商后台入口，按其正式流程登记 HTTP 隧道，再使用登记后的准确名称配置和验证。隧道参数：域名 `xxian.fun`，类型 HTTP，本地地址 `127.0.0.1`、端口 `18090`，不启用 PROXY 协议。不能靠随意改代理名或复用其他隧道绕过登记。

## 已核对的入口

- 公网 HTTP 的 404 来自 FRP，而不是应用或 Caddy。
- 宿主 Caddy 的 `127.0.0.1:18090` 已将 `Host: xxian.fun` 的请求以 308 跳转到相同 HTTPS 路径，查询参数保留。
- 当前 `/home/rong/.config/frp/frpc.toml` 包含 SSH 和 HTTPS，缺少 `xxian.fun` 的 HTTP 域名转发。
- 现有 HTTPS 指向 18443，并启用 PROXY v2。HTTP 应指向 18090，不发送此头；Caddy 的 80 端口不接受 HTTPS 端口使用的这一封装。

## 候选配置

使用 [准备脚本](../../scripts/prepare_http_redirect.py) 从当前配置生成独立候选：

```sh
python3 /path/to/prepare_http_redirect.py \
  --source /home/rong/.config/frp/frpc.toml \
  --output /home/rong/.config/frp/mapflow-http-redirect.toml

/home/rong/.local/opt/frp/frp_0.64.0_linux_amd64/frpc verify \
  -c /home/rong/.config/frp/mapflow-http-redirect.toml
```

脚本复制原连接身份、认证和公共传输配置，只生成一条 HTTP 代理，不复制 SSH／HTTPS 代理或管理端口。候选包含私有身份信息，以 0600 权限新建；已存在目标直接拒绝，不覆盖原配置、不启动服务、不将真实配置提交 Git。

10 月 20 日的准备阶段曾用测试身份验证生成结果和拒绝覆盖行为，也在宿主临时目录读取真实配置生成候选，使用已安装的 frpc 0.64.0 校验通过。当时原配置摘要未变化，临时候选已移除，未连接公网注册。10 月 21 日正式注册的失败原因见本页首段，仍不能宣称公网 HTTP 已修好。

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
