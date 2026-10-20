# 手机画布发布前的 HTTP 转发准备

2026-10-20：仅准备与验证，尚未启用或部署。用户要求先检查独立本地界面，再决定上线。

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

已用测试身份验证生成结果和拒绝覆盖行为；也在宿主临时目录中读取真实配置生成候选，使用已安装的 frpc 0.64.0 校验通过。原配置摘要未变化，临时候选已移除，没有连接公网注册新路由。因此当前仍不能宣称公网 HTTP 已修好。

## 用户确认后才启用

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
