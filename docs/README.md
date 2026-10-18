# MapFlow 文档入口

新任务先读根目录 [AGENTS](../AGENTS.md) 和 [HANDOVER](../HANDOVER.md)，再按任务读取合同和源码。

## 当前开发与生产

- [固定工作区入口](workflow/workspace-entry.md)
- [当前生产与未部署改动](current-release.md)
- [生产与收款入口](workflow/production.md)
- [模型选择边界](workflow/chat-model-selection.md)
- [领域用语](../CONTEXT.md)

## 当前合同

- [全站新前端](specs/2026-10-14-full-frontend-rebuild-design.md)
- [全局助手与知识库](specs/2026-10-15-global-assistant-guidance-design.md)
- [平台助手与角色边界](specs/2026-10-15-platform-assistant-boundary-design.md)
- [共享聊天核心](specs/2026-10-16-chat-scene-core-design.md)
- [独立智能体会话](specs/2026-10-16-tavern-agent-conversations-design.md)
- [学习画布和主题动画](specs/2026-10-16-learning-canvas-theme-transition-design.md)
- [会话持久删除](specs/2026-10-13-chat-layout-and-conversation-deletion-design.md)
- [BYOK 执行隔离](specs/2026-10-16-byok-execution-design.md)
- [异常卡片显示条件](specs/2026-10-17-chat-error-visibility-design.md)

模型目录、参数合同和持久验证见后端 docs/operations/chat-model-catalog.md。

## 历史证据

research/ 保存带日期的验收和发布。记录只证明对应版本和条件，不能当作新版本已测试的依据。最新生产从 current-release 进入。

deployment/ 保留的旧记录和冻结脚本用于来源和回退核对；脚本可能依赖当时留存的运维模块，不能直接当作当前通用发布器。

2026-10-18 已删除已结束任务的旧计划、重复交接和被新前端替代的界面方案。旧文档可从 Git 历史恢复，清理前快照为 5e962568c15e4da411d8054c662317cbeb861720。引用旧文件时链接到历史提交，不在当前目录留下互相矛盾的操作指南。
