# 本机main开发与启动

用户已于2026-11-05确认：保留已做好的新版地图、原画布节点收纳与同草稿断线续作，核验后合入本地main；日常使用固定目录开发，旧工作区停用并保留。封板期间只修复和微调既有功能。

## 打开源码

- 前端：`D:/MapFlow-publish`。
- 后端与原生Worker：`D:/mapflow-server`。
- 图谱引擎：`D:/skill-tree-engine`。
- VS Code工作区：`D:/MapFlow-operations/MapFlow-手动开发.code-workspace`。完成切换后该入口指向上述固定目录，不再指向E盘旧工作树。

先读项目AGENTS，运行：

```powershell
python D:/MapFlow-publish/scripts/workspace_entry.py --development
```

通常在同一目录从最新本地main开codex/分支。检查器会保留并报告编辑，不自动保存、切支或删除文件。合入收尾时不加development参数，验证main与工作区的严格状态。当前main可能领先远端；本机合并、推送和生产部署分别处理，不自动推送或上线。

## 启动本地开发站

本机启动入口在仓库外，只读取固定源码与私有本机配置：

```powershell
python D:/MapFlow-operations/start-mapflow-local.py
```

地址为 `https://localhost:19381`。前端使用Vite的HTTPS开发模式，保存src内界面/样式文件后浏览器自动更新；后端是从D盘main代码构建的完整服务器组装。更改后端Rust代码后需重新构建并重启本机服务，不能用前端热更新代替后端重编译。

本地PostgreSQL、Rust后端、Node Worker和Vite均直接在Windows运行，不依赖Docker。AI调用仍需原上游网络与本机模型凭据。数据库、账号、地图、进度及模型配置沿用原隔离验收环境，生产数据和生产运行不受本地源码编辑影响。

启动器支持 `--status`、`--stop`、`--restart`。已有AI执行未结束时拒绝停止/重启，先在页面结束该执行。修改后端或引擎后运行 `--restart` 重新构建；本机运行器仅在本地将引擎依赖指向D:/skill-tree-engine，产品Cargo.toml/Cargo.lock仍保持正式Git rev。停止本地网站不会停止或删除数据库。

前端HTTPS证书通过 `MAPFLOW_DEV_HTTPS_KEY_FILE` 和 `MAPFLOW_DEV_HTTPS_CERT_FILE` 显式传入，API目标由 `MAPFLOW_API_TARGET` 设置；不提供证书时保留Vite原有HTTP开发行为。私有凭据和数据库连接文件保存在源码目录之外，不写入Git或网页静态文件。

## 判断自己看的是否为当前源码

本地运行身份记录为 `D:/MapFlow-operations/local-main-runtime.json`，含源码目录、分支、提交、端口和本任务进程信息。它只是启动时快照，继续编辑/切支后应重新核对Git；不以旧交接里的HEAD代替真实状态。

旧E盘工作树、旧启动器和其他会话目录保留恢复能力，停止作为日常入口。旧node_modules可能通过目录链接复用D盘依赖，不能按旧目录名字自动删除共享依赖。若要清理，须另行核对消费者、完整保存及恢复验证。

完整整合涉及引擎新提交。后端Cargo.toml与Cargo.lock的Git rev必须一致；本机Cargo缓存可用不等于未推送提交已可供其他机器获取。正式推送/发布时另行保证引擎提交可获取，再推进后端与前端。
