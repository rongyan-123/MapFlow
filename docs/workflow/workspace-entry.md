# 固定开发目录与分支

本机前端入口为 `D:/MapFlow-publish`，后端入口为 `D:/mapflow-server`，引擎为 `D:/skill-tree-engine`。用户于2026-11-05确认：日常使用固定目录，在同一目录从最新本地 main 建立 codex/ 分支，不因每次微调新增目录。main 是整合基线，可能包含尚未推送的已确认提交。

## 开始前检查

```powershell
python D:/MapFlow-publish/scripts/workspace_entry.py --development
```

开发模式退出码0表示固定入口属于登记产品仓库、处于main或codex/分支、包含当前本地main与origin/main，且远端main与跟踪记录一致。编辑中的已跟踪/未跟踪文件只报告数量与提示并原样保留，不因此要求新建目录。错误仓库、detached HEAD、缺少本地main、旧分支或远端核对失败仍返回1。检查通过不等于工作区干净。

合入收尾不加 `--development`，执行严格检查：两个固定入口必须在main、包含最新已确认远端main且产品工作区干净。纯本地后续提交允许存在，不能把“未推送”误报为基线错误。

可输出 JSON，或检查其他机器的完整仓库根目录：

```powershell
python scripts/workspace_entry.py --development --json
python scripts/workspace_entry.py --development --repo D:/MapFlow-publish --expected-repository rongyan-123/MapFlow
```

检查器只读，不自动 fetch、改分支、写索引、覆盖工作或删除文件。远端已有新提交时，先 `git fetch origin`，再保存本地工作并核对差距。已包含远端 main 的本地后续提交允许存在，JSON 结果会显示 ahead/behind；是否推送单独按任务授权处理。

## 同一目录开发

先保存当前工作、核对本地与远端main，再在固定目录创建明确任务名的分支。已有未保存编辑或其他会话正在使用的分支不能被擅自切换。用户明确要求直接在main修改时按其要求执行，TDD及验证规则保持。

```powershell
git -C D:/MapFlow-publish switch main
git -C D:/MapFlow-publish switch -c codex/example-polish
```

在同一目录完成计划、TDD、验证与提交，确认后合回main。只有确实需要并行隔离时才另用worktree，优先复用已有目录。已有旧目录与会话保留；合并main不会使其他工作区自动更新，也不自动允许清理它们。本地启动方式见[main开发与启动](local-main-development.md)。

## 收尾与更新固定入口

完成测试和审查后，按已授权流程将功能合入 main。核对远端是否收到其他更新，保持固定目录没有未保存的产品改动，再同步固定主线并运行入口检查。

```powershell
git -C D:/MapFlow-publish fetch origin
git -C D:/MapFlow-publish merge --ff-only origin/main
python D:/MapFlow-publish/scripts/workspace_entry.py
```

若存在改动、main 分歧或其他目录占用 main，先完整保存并验证恢复，不使用强制 checkout/reset/clean 代替保存。检查失败时保留工作并查明原因，不自动覆盖。

清理开发 worktree 前核对已合入提交、所有会话/路径依赖、运行消费者、目录链接及独立恢复证据。有关联会话的目录保持原位。生产发布、收款辅助脚本迁移和定时任务更新单独验证；本机入口更新不等于部署。

## 任务结束时收尾

完成合入后，停止本任务专用且已不需要的预览和临时服务，登记并清理无消费者的可重建缓存。SDK、下载包和运维工具使用稳定的仓库外目录；不要把它们作为产品源文件，也不要让新的共享依赖继续指向已结束 worktree。

本地与远端分支先保存完整 tip、验证已合入及恢复能力，再绑定预期 SHA 删除。尚有独有提交或未保存工作的分支先登记，不直接丢弃。有关联会话的目录和 Git 检查点保留；目录保留不表示必须永远保留每个已结束的功能分支名。

当前文档从 [文档目录](../README.md)、[交接](../../HANDOVER.md) 和 [当前生产发布](../current-release.md) 进入。旧方案从 Git 历史查询，不再在根交接文件叠加“当前版本”段落。

## 本机已保存的旧工作

2026-10-14 恢复固定入口前，原前后端目录的所有工作文件（含 ignored/未跟踪资料、嵌套 Git）、原索引、未提交补丁和代码对象已私有归档，并在独立库逐项恢复验证。原开发分支保留，原未提交工作没有混入 main。恢复位置由本机维护记录登记，不把私有归档内容提交到仓库。

仍保留的带日期目录是历史开发/验收环境，可能包含未合入工作或依赖；不能凭文件夹名称或旧交接文档判断为当前 main。有关联会话的目录保留原路径。没有会话或运行依赖、已经合入且完整恢复验证通过的旧工作区，可以在授权范围内移除。按任务需要复用环境时，核对其真实 HEAD 与当前主线。

原位保留的 SDK、收款工具及本地证据按已核对路径设置仅属于固定工作区的忽略规则。产品源码审计使用 `git ls-files`；需要查看这些本地资料时单独确认范围和隐私要求。

## 验证检查器

```powershell
python -m unittest discover -s scripts/tests -p test_workspace_entry.py -v
```

测试使用独立的临时 Git 仓库，覆盖错误仓库/目录、功能分支、detached HEAD、远端跟踪过期、main 落后、未保存工作以及正确主线；不操作真实项目分支。
