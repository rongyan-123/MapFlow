import type { LearningTreeSnapshot } from '../types/learning';

export const AGENT_TREE: LearningTreeSnapshot = {
 "tree": {
  "id": "9369e054-3c40-4a46-9952-3abbde4195a1",
  "topic": "Python Agent Development",
  "title": "生产级 AI Agent 应用开发完整体系（Python）",
  "description": "Agent 开发主线知识树：Python 基础 → FastAPI 服务层 → LLM 原理与 API → Agent 核心（含 MCP）→ LangChain/LangGraph 深度 → Agent 模式与实战 → ML 基础（了解）→ RAG 深度 → 生产化与毕业项目",
  "difficulty_level": "intermediate",
  "total_nodes": 74
 },
 "current_node_id": "0bc47c29-37d7-4108-977e-3bbbc27871d1",
 "nodes": [
  {
   "id": "d2e470c6-53fa-42d4-a76b-5e8e2bbeafdc",
   "tree_id": "9369e054-3c40-4a46-9952-3abbde4195a1",
   "title": "Python 语法快速入门（面向有经验者）",
   "description": "针对已有 JS/TS 经验的学习者，快速建立 Python 语法心智：缩进、内置类型、流程控制与标准库习惯。",
   "icon": "code",
   "category": "Python 基础",
   "difficulty": 1,
   "estimated_minutes": 90,
   "depth_level": 1,
   "position_x": 0.0,
   "position_y": 0.0,
   "order_in_level": 0,
   "learning_objectives": "[\"能用 Python 写出与 JS 等价的基础逻辑（循环、条件、dict/list 操作）\", \"能读懂并改写一段中等复杂度的 Python 代码\"]",
   "key_concepts": "[\"缩进与代码块\", \"内置类型 dict/list/tuple/set\", \"标准库 os/json/pathlib\"]",
   "recommended_depth": "Understand",
   "depth_rationale": "本节点是全部后续学习的语法地基；学习者已有编程经验，重点在差异而非从零教学。",
   "observable_evidence": "[\"把一段 JS 函数改写为等价的 Python 实现并跑通\", \"解释 Python 缩进与 JS 花括号在作用域语义上的区别\"]"
  },
  {
   "id": "9342764f-dc9a-4dc1-a67a-d1aea8d506bf",
   "tree_id": "9369e054-3c40-4a46-9952-3abbde4195a1",
   "title": "类型系统与数据结构",
   "description": "理解 Python 的动态类型与渐进式类型注解：可变/不可变、鸭子类型、typing 模块核心用法，与 TS 类型系统对照。",
   "icon": "code",
   "category": "Python 基础",
   "difficulty": 1,
   "estimated_minutes": 120,
   "depth_level": 1,
   "position_x": 0.0,
   "position_y": 0.0,
   "order_in_level": 0,
   "learning_objectives": "[\"能解释可变与不可变对象的区别及各自陷阱\", \"能写出带类型注解的函数签名并通过 mypy\"]",
   "key_concepts": "[\"类型注解 typing\", \"可变与不可变\", \"None 与 falsy 语义\"]",
   "recommended_depth": "Understand",
   "depth_rationale": "Agent 开发（尤其 LangChain 源码阅读）依赖对 Python 类型系统的准确理解。",
   "observable_evidence": "[\"用类型注解写一个处理 JSON 数据的函数并跑 mypy 通过\", \"解释为什么 Python 中默认参数不能是可变对象\"]"
  },
  {
   "id": "5601a744-824e-438e-b5c1-d7cb71738109",
   "tree_id": "9369e054-3c40-4a46-9952-3abbde4195a1",
   "title": "函数、闭包与装饰器工厂",
   "description": "理解 Python 一等函数与装饰器机制：闭包、*args/**kwargs、装饰器工厂与 functools.wraps。",
   "icon": "tool",
   "category": "Python 基础",
   "difficulty": 2,
   "estimated_minutes": 150,
   "depth_level": 1,
   "position_x": 0.0,
   "position_y": 0.0,
   "order_in_level": 0,
   "learning_objectives": "[\"能写出一个带参数的装饰器工厂\", \"能解释闭包捕获变量的规则\"]",
   "key_concepts": "[\"装饰器与装饰器工厂\", \"闭包与函数作用域\", \"*args/**kwargs 与 functools.wraps\"]",
   "recommended_depth": "Understand",
   "depth_rationale": "FastAPI 路由、LangChain @tool、LangGraph 节点都重度使用装饰器/高阶函数，不理解它将无法阅读框架源码。",
   "observable_evidence": "[\"实现一个计时装饰器工厂并验证效果\", \"解释 functools.wraps 的作用与不用的后果\"]"
  },
  {
   "id": "a0e1efda-207f-4d71-aa0d-880ba9459d9c",
   "tree_id": "9369e054-3c40-4a46-9952-3abbde4195a1",
   "title": "迭代器、生成器与 yield",
   "description": "掌握迭代器协议、生成器与 yield/yield from、惰性求值：这是 LLM 流式输出与流式管道的语言级地基。",
   "icon": "code",
   "category": "Python 基础",
   "difficulty": 2,
   "estimated_minutes": 120,
   "depth_level": 1,
   "position_x": 0.0,
   "position_y": 0.0,
   "order_in_level": 0,
   "learning_objectives": "[\"能写出一个生成器并解释其惰性求值\", \"能用生成器实现流式数据管道\"]",
   "key_concepts": "[\"迭代器协议\", \"生成器与 yield\", \"惰性求值与内存收益\"]",
   "recommended_depth": "Use",
   "depth_rationale": "LLM 流式输出、SSE、LangChain streaming 全部建立在生成器之上，也是 asyncio 异步流的前置。",
   "observable_evidence": "[\"用生成器实现一个逐行处理大文件的管道并对比内存占用\", \"解释 yield 与 return 在函数执行上的本质差异\"]"
  },
  {
   "id": "7c19a329-ef4f-4184-8e68-25dc39d9cd36",
   "tree_id": "9369e054-3c40-4a46-9952-3abbde4195a1",
   "title": "asyncio 深入：事件循环与并发原语",
   "description": "掌握 Python 异步模型：async/await、事件循环、Task 层级、并发原语（gather/wait/锁/信号量），与 JS 异步对照。",
   "icon": "code",
   "category": "Python 基础",
   "difficulty": 3,
   "estimated_minutes": 180,
   "depth_level": 1,
   "position_x": 0.0,
   "position_y": 0.0,
   "order_in_level": 0,
   "learning_objectives": "[\"能写一个并发拉取多个 HTTP 资源的异步函数并控制并发度\", \"能解释 async 函数与普通函数互调的限制及解法\"]",
   "key_concepts": "[\"async/await 与事件循环\", \"asyncio.gather/wait 与信号量\", \"同步阻塞与事件循环饥饿\"]",
   "recommended_depth": "Use",
   "depth_rationale": "LLM API 调用、流式输出与 FastAPI 全异步栈都以 asyncio 为核心，是后续所有网络章节的前置。",
   "observable_evidence": "[\"用 asyncio + 信号量并发完成 10 个 API 请求并测量耗时\", \"解释为什么在 async 函数里用同步 requests 会卡住整个服务\"]"
  },
  {
   "id": "60428e17-cbea-47f8-abe7-ad9836d507dc",
   "tree_id": "9369e054-3c40-4a46-9952-3abbde4195a1",
   "title": "虚拟环境与工程结构",
   "description": "掌握 Python 项目工程化：uv/venv、pyproject.toml、依赖锁定、包与模块组织，与 Node 的 package.json/npm 对照。",
   "icon": "tool",
   "category": "Python 基础",
   "difficulty": 1,
   "estimated_minutes": 90,
   "depth_level": 1,
   "position_x": 0.0,
   "position_y": 0.0,
   "order_in_level": 0,
   "learning_objectives": "[\"能初始化一个带虚拟环境与依赖清单的 Python 项目\", \"能组织多文件包结构并正确导入\"]",
   "key_concepts": "[\"uv/venv 与依赖锁定\", \"pyproject.toml 与 requirements.txt\", \"包与模块导入\"]",
   "recommended_depth": "Use",
   "depth_rationale": "后续所有项目（FastAPI、LangChain）都需要规范的工程结构；对照 Nest 项目结构理解差异。",
   "observable_evidence": "[\"用 uv 初始化一个新 Python 项目并安装两个依赖\", \"解释虚拟环境为什么是必需的\"]"
  },
  {
   "id": "20d55018-d087-4139-9b61-bd9f448b3e71",
   "tree_id": "9369e054-3c40-4a46-9952-3abbde4195a1",
   "title": "异常处理与日志体系",
   "description": "掌握异常层级与 try/except/finally、自定义异常、logging 体系（logger/Handler/格式化），与 JS try/catch 对照。",
   "icon": "shield",
   "category": "Python 基础",
   "difficulty": 2,
   "estimated_minutes": 90,
   "depth_level": 1,
   "position_x": 0.0,
   "position_y": 0.0,
   "order_in_level": 0,
   "learning_objectives": "[\"能设计合理的异常层级与捕获策略\", \"能用 logging 搭建带格式化的日志\"]",
   "key_concepts": "[\"异常层级与捕获\", \"自定义异常\", \"logging 体系\"]",
   "recommended_depth": "Use",
   "depth_rationale": "生产 Agent 服务的可观测性始于日志；NestJS 有成熟的 logger 体系可对照迁移。",
   "observable_evidence": "[\"为一个模块设计异常层级并写日志\", \"对比 logging 与 print 在生产中的差异\"]"
  },
  {
   "id": "af2e6854-6767-4fe8-9ace-e65e801d91b8",
   "tree_id": "9369e054-3c40-4a46-9952-3abbde4195a1",
   "title": "FastAPI 路由与请求处理",
   "description": "掌握 FastAPI 基础：路径/查询参数、请求体、响应模型、异常处理，与 NestJS 路由对照理解。",
   "icon": "code",
   "category": "FastAPI",
   "difficulty": 2,
   "estimated_minutes": 120,
   "depth_level": 2,
   "position_x": 0.0,
   "position_y": 0.0,
   "order_in_level": 0,
   "learning_objectives": "[\"能写一个带路径/查询参数与请求体的 CRUD 接口\", \"能解释 FastAPI 如何自动生成 OpenAPI 文档\"]",
   "key_concepts": "[\"路径与查询参数\", \"请求/响应模型\", \"OpenAPI 自动文档\"]",
   "recommended_depth": "Use",
   "depth_rationale": "FastAPI 是 Agent 服务对外的 HTTP 载体，其 Pydantic 模型体系与 NestJS DTO 概念同构。",
   "observable_evidence": "[\"实现一个 /items CRUD 接口并在 /docs 验证\", \"对照 NestJS 解释 FastAPI 的参数校验方式\"]"
  },
  {
   "id": "0288aab3-c9d4-4892-8df7-8ea3146fc589",
   "tree_id": "9369e054-3c40-4a46-9952-3abbde4195a1",
   "title": "Pydantic 模型与输入校验",
   "description": "理解 Pydantic v2 模型：字段校验、类型转换、嵌套模型、Field 约束与自定义验证器。",
   "icon": "shield",
   "category": "FastAPI",
   "difficulty": 2,
   "estimated_minutes": 120,
   "depth_level": 2,
   "position_x": 0.0,
   "position_y": 0.0,
   "order_in_level": 0,
   "learning_objectives": "[\"能定义带校验规则的嵌套模型\", \"能写自定义验证器处理特殊业务规则\"]",
   "key_concepts": "[\"Pydantic BaseModel\", \"字段约束与 Field\", \"嵌套模型与序列化\"]",
   "recommended_depth": "Use",
   "depth_rationale": "Agent 的工具契约、结构化输出解析都以 Pydantic 为基石，是本树最常用库之一。",
   "observable_evidence": "[\"定义一个带约束的嵌套模型并演示校验失败\", \"解释 FastAPI 请求体为何等于 Pydantic 模型\"]"
  },
  {
   "id": "cca38f80-b13e-4cf3-abcd-42a62972e65e",
   "tree_id": "9369e054-3c40-4a46-9952-3abbde4195a1",
   "title": "Pydantic v2 深入：validator/泛型/序列化",
   "description": "深入 Pydantic v2：field_validator/model_validator、泛型模型、model_dump/model_validate、序列化与解析全貌。",
   "icon": "shield",
   "category": "FastAPI",
   "difficulty": 3,
   "estimated_minutes": 150,
   "depth_level": 2,
   "position_x": 0.0,
   "position_y": 0.0,
   "order_in_level": 0,
   "learning_objectives": "[\"能写交叉字段校验的 validator\", \"能用泛型模型复用复杂结构\"]",
   "key_concepts": "[\"field/model_validator\", \"泛型模型 Generic\", \"序列化与解析\"]",
   "recommended_depth": "Use",
   "depth_rationale": "Agent 工具契约、结构化输出、配置管理都建立在 Pydantic 之上；深挖是阅读 LangChain 源码的基础。",
   "observable_evidence": "[\"定义带交叉字段校验的嵌套模型并演示失败路径\", \"用泛型模型处理 API 响应并解析\"]"
  },
  {
   "id": "b77d7727-7c28-4600-b3fb-3b2be509caf2",
   "tree_id": "9369e054-3c40-4a46-9952-3abbde4195a1",
   "title": "依赖注入与中间件",
   "description": "理解 FastAPI 依赖注入系统与中间件机制：Depends、作用域、异常处理，与 NestJS DI 的对照。",
   "icon": "puzzle",
   "category": "FastAPI",
   "difficulty": 3,
   "estimated_minutes": 120,
   "depth_level": 2,
   "position_x": 0.0,
   "position_y": 0.0,
   "order_in_level": 0,
   "learning_objectives": "[\"能用 Depends 实现共享依赖（如 DB 连接、当前用户）\", \"能写一个记录请求耗时的中间件\"]",
   "key_concepts": "[\"Depends 与依赖作用域\", \"中间件与异常处理\", \"与 NestJS DI 的对照\"]",
   "recommended_depth": "Understand",
   "depth_rationale": "依赖注入决定 Agent 服务的扩展方式（模型客户端、存储、鉴权都是可注入依赖）。",
   "observable_evidence": "[\"用 Depends 注入一个可复用的鉴权依赖\", \"画图对比 FastAPI 与 NestJS 的 DI 差异\"]"
  },
  {
   "id": "3d6c07f7-db74-4e2a-9ed2-6c3e3f274971",
   "tree_id": "9369e054-3c40-4a46-9952-3abbde4195a1",
   "title": "流式响应与 SSE",
   "description": "掌握在 FastAPI 中实现流式输出：SSE 与 StreamingResponse、异步生成器，这是 LLM 聊天接口的核心形态。",
   "icon": "rocket",
   "category": "FastAPI",
   "difficulty": 3,
   "estimated_minutes": 150,
   "depth_level": 2,
   "position_x": 0.0,
   "position_y": 0.0,
   "order_in_level": 0,
   "learning_objectives": "[\"能实现一个 SSE 流式聊天接口\", \"能解释流式响应与普通 JSON 响应的区别\"]",
   "key_concepts": "[\"SSE 协议\", \"StreamingResponse\", \"异步生成器\"]",
   "recommended_depth": "Use",
   "depth_rationale": "LLM 输出天然是流式的，所有 Agent 服务最终都要面对流式协议。",
   "observable_evidence": "[\"实现 /chat/stream 接口并用 curl 观察增量输出\", \"解释为什么流式体验对 LLM 应用至关重要\"]"
  },
  {
   "id": "c351e62a-2075-4257-8fc0-40c69cf732d5",
   "tree_id": "9369e054-3c40-4a46-9952-3abbde4195a1",
   "title": "异步状态管理与数据库（了解）",
   "description": "【了解·Nest 可对照】Python 生态的异步存储概览：SQLAlchemy async、Redis、Agent 会话持久化模式；细节在 Nest 项目深入。",
   "icon": "compass",
   "category": "FastAPI",
   "difficulty": 2,
   "estimated_minutes": 90,
   "depth_level": 2,
   "position_x": 0.0,
   "position_y": 0.0,
   "order_in_level": 0,
   "learning_objectives": "[\"能说出 Python 生态的异步存储方案\", \"能理解 Agent 会话持久化的基本模式\"]",
   "key_concepts": "[\"SQLAlchemy async 概览\", \"Redis 与缓存\", \"会话状态持久化模式\"]",
   "recommended_depth": "Recognize",
   "depth_rationale": "通用知识：与 NestJS 的 TypeORM/Redis 实践同构；此节点只需建立选型认知，后端细节不在此深入。",
   "observable_evidence": "[\"画图对比 Python 与 NestJS 的存储方案选型\", \"说明 Agent 会话持久化为什么用 thread_id + 数据库\"]"
  },
  {
   "id": "08011079-802d-4d84-b916-fad4326c8d21",
   "tree_id": "9369e054-3c40-4a46-9952-3abbde4195a1",
   "title": "FastAPI 测试：pytest/TestClient",
   "description": "掌握 FastAPI 测试方法：TestClient、依赖覆盖、异步接口测试、pytest fixture 体系。",
   "icon": "shield",
   "category": "FastAPI",
   "difficulty": 2,
   "estimated_minutes": 150,
   "depth_level": 2,
   "position_x": 0.0,
   "position_y": 0.0,
   "order_in_level": 0,
   "learning_objectives": "[\"能为接口写单元与集成测试\", \"能用依赖覆盖替换真实依赖进行测试\"]",
   "key_concepts": "[\"pytest 与 fixture\", \"TestClient 与依赖覆盖\", \"异步测试\"]",
   "recommended_depth": "Use",
   "depth_rationale": "Agent 应用评测依赖可靠的测试基础，先建立测试习惯再进入 Agent 阶段。",
   "observable_evidence": "[\"为 /items 接口写 3 个测试用例并跑通\", \"用依赖覆盖测试鉴权失败的路径\"]"
  },
  {
   "id": "6ee00efb-e9fb-4f53-9ccb-1969898d8b0d",
   "tree_id": "9369e054-3c40-4a46-9952-3abbde4195a1",
   "title": "LLM 原理：Transformer 到生成机制",
   "description": "建立大模型心智模型：token 与自回归生成、Transformer/注意力概览、预训练/指令微调/RLHF 各解决什么问题。",
   "icon": "lightbulb",
   "category": "LLM API",
   "difficulty": 2,
   "estimated_minutes": 150,
   "depth_level": 3,
   "position_x": 0.0,
   "position_y": 0.0,
   "order_in_level": 0,
   "learning_objectives": "[\"能解释 token 与自回归生成机制\", \"能解释预训练、指令微调与 RLHF 的作用\"]",
   "key_concepts": "[\"token 与自回归\", \"Transformer 与注意力概览\", \"预训练、微调与 RLHF\"]",
   "recommended_depth": "Understand",
   "depth_rationale": "所有 Agent 行为都是模型能力的投影，先懂模型才能设计可靠的 Agent；这是社区路线的第一步。",
   "observable_evidence": "[\"用自己的话解释 LLM 生成一句话的完整机制\", \"解释为什么同样的 prompt 输出不稳定\"]"
  },
  {
   "id": "4d9bfb2b-45a2-4665-8bec-698482d1d279",
   "tree_id": "9369e054-3c40-4a46-9952-3abbde4195a1",
   "title": "Token、上下文窗口与计费模型",
   "description": "理解 token 计费模型、上下文预算与成本估算：输入/输出 token 定价、缓存、上下文膨胀控制。",
   "icon": "lightbulb",
   "category": "LLM API",
   "difficulty": 2,
   "estimated_minutes": 120,
   "depth_level": 3,
   "position_x": 0.0,
   "position_y": 0.0,
   "order_in_level": 0,
   "learning_objectives": "[\"能估算一个请求的 token 与成本\", \"能设计控制上下文膨胀的策略\"]",
   "key_concepts": "[\"token 计费与定价\", \"上下文预算\", \"prompt caching\"]",
   "recommended_depth": "Understand",
   "depth_rationale": "Agent 的每一轮循环都消耗 token，成本失控是 Agent 应用的第一生产事故。",
   "observable_evidence": "[\"计算一个典型对话场景的 token 成本并设计压缩策略\", \"解释 prompt caching 的适用场景\"]"
  },
  {
   "id": "90a111bf-94dd-461d-84bf-28202ee189d3",
   "tree_id": "9369e054-3c40-4a46-9952-3abbde4195a1",
   "title": "采样与推理参数",
   "description": "掌握推理参数：temperature/top_p/top_k/seed/stop 的作用与调优、结构化解码的底层机制。",
   "icon": "tool",
   "category": "LLM API",
   "difficulty": 3,
   "estimated_minutes": 120,
   "depth_level": 3,
   "position_x": 0.0,
   "position_y": 0.0,
   "order_in_level": 0,
   "learning_objectives": "[\"能解释各采样参数对输出的影响\", \"能按任务类型选择合适的参数组合\"]",
   "key_concepts": "[\"采样策略 temperature/top_p\", \"seed 与可复现性\", \"停止条件与结构化约束\"]",
   "recommended_depth": "Use",
   "depth_rationale": "生产调优的第一现场；Agent 循环的决策质量直接受采样参数影响。",
   "observable_evidence": "[\"同一 prompt 用不同 temperature 对比输出差异并解释原因\", \"为工具调用场景设计参数组合\"]"
  },
  {
   "id": "b62cbb4f-735d-43c4-8735-dd1b5aebf371",
   "tree_id": "9369e054-3c40-4a46-9952-3abbde4195a1",
   "title": "Anthropic Messages API 深度",
   "description": "掌握 Anthropic Messages API 完整形态：角色与消息结构、system prompt、工具定义、stop_reason、多轮历史。",
   "icon": "code",
   "category": "LLM API",
   "difficulty": 3,
   "estimated_minutes": 180,
   "depth_level": 3,
   "position_x": 0.0,
   "position_y": 0.0,
   "order_in_level": 0,
   "learning_objectives": "[\"能用 SDK 完成多轮对话与工具调用\", \"能解释 stop_reason 与消息流的完整生命周期\"]",
   "key_concepts": "[\"Messages API 与角色\", \"stop_reason 与流程控制\", \"Python SDK 与工具绑定\"]",
   "recommended_depth": "Use",
   "depth_rationale": "直接调用官方 SDK 是理解 Agent 循环的最短路径，也是后续框架的底层依赖。",
   "observable_evidence": "[\"用 SDK 完成一次带工具调用的完整会话并打印消息流\", \"解释 stop_reason 各取值对应什么场景\"]"
  },
  {
   "id": "3f1f3348-a59e-4511-9111-7c09bdaf622f",
   "tree_id": "9369e054-3c40-4a46-9952-3abbde4195a1",
   "title": "流式与事件 API",
   "description": "掌握流式响应协议：SSE、SDK 流式事件（message_start/content_block_delta 等）、增量处理与中断。",
   "icon": "rocket",
   "category": "LLM API",
   "difficulty": 3,
   "estimated_minutes": 120,
   "depth_level": 3,
   "position_x": 0.0,
   "position_y": 0.0,
   "order_in_level": 0,
   "learning_objectives": "[\"能实现流式对话并处理增量事件\", \"能解释流式与一次性响应的差异\"]",
   "key_concepts": "[\"SSE 流式协议\", \"SDK 流式事件\", \"增量渲染与中断\"]",
   "recommended_depth": "Use",
   "depth_rationale": "LLM 输出天然流式；用户体感与长任务体验依赖流式实现。",
   "observable_evidence": "[\"用 SDK 流式输出并逐事件打印\", \"解释中断一个流式请求时会发生什么\"]"
  },
  {
   "id": "44c17298-ff37-4f87-8ecc-40d02da79202",
   "tree_id": "9369e054-3c40-4a46-9952-3abbde4195a1",
   "title": "OpenAI 兼容协议与多供应商抽象",
   "description": "理解 OpenAI 兼容协议与供应商抽象：base_url、模型映射、多供应商切换模式。",
   "icon": "tool",
   "category": "LLM API",
   "difficulty": 3,
   "estimated_minutes": 120,
   "depth_level": 3,
   "position_x": 0.0,
   "position_y": 0.0,
   "order_in_level": 0,
   "learning_objectives": "[\"能通过 OpenAI 兼容接口调用非 OpenAI 模型\", \"能设计一个供应商抽象层\"]",
   "key_concepts": "[\"OpenAI 兼容协议\", \"base_url 与模型映射\", \"供应商抽象\"]",
   "recommended_depth": "Use",
   "depth_rationale": "生产环境必然面对多供应商；理解兼容协议避免被单一供应商锁定。",
   "observable_evidence": "[\"用兼容协议把同一个调用切到两个不同供应商\", \"列出兼容协议与原生协议的主要差异\"]"
  },
  {
   "id": "0bc47c29-37d7-4108-977e-3bbbc27871d1",
   "tree_id": "9369e054-3c40-4a46-9952-3abbde4195a1",
   "title": "Prompt 工程：可复现与结构化输出",
   "description": "提示工程系统化：指令与角色设计、few-shot、CoT 推理引导、格式约束、输出校验循环与调试方法论。",
   "icon": "lightbulb",
   "category": "LLM API",
   "difficulty": 3,
   "estimated_minutes": 180,
   "depth_level": 3,
   "position_x": 0.0,
   "position_y": 0.0,
   "order_in_level": 0,
   "learning_objectives": "[\"能稳定产出结构化输出\", \"能系统调试 prompt 而非盲目修改\"]",
   "key_concepts": "[\"指令与 few-shot 设计\", \"CoT 与推理引导\", \"输出校验与重试循环\"]",
   "recommended_depth": "Use",
   "depth_rationale": "提示是 Agent 行为的唯一可编程接口，提示工程质量直接决定 Agent 可用性。",
   "observable_evidence": "[\"把同一任务用 3 种 prompt 写法对比输出质量并给出选择\", \"设计一个稳定输出 JSON 的 prompt 与校验机制\"]"
  },
  {
   "id": "198c0871-3f90-445f-98e7-a3c74145204f",
   "tree_id": "9369e054-3c40-4a46-9952-3abbde4195a1",
   "title": "Prompt 缓存与成本优化",
   "description": "掌握 prompt caching 机制与收益模型：缓存结构要求、命中率优化、与工具裁剪/历史压缩的组合策略。",
   "icon": "shield",
   "category": "LLM API",
   "difficulty": 3,
   "estimated_minutes": 120,
   "depth_level": 3,
   "position_x": 0.0,
   "position_y": 0.0,
   "order_in_level": 0,
   "learning_objectives": "[\"能设计提升缓存命中率的 prompt 结构\", \"能估算缓存带来的成本节省\"]",
   "key_concepts": "[\"prompt caching 机制\", \"缓存结构设计\", \"成本估算与优化\"]",
   "recommended_depth": "Use",
   "depth_rationale": "Agent 每轮循环都消费 token，成本失控是第一生产事故；缓存是最大的成本杠杆。",
   "observable_evidence": "[\"设计一个缓存友好的 system prompt 结构并实测命中率\", \"计算一个高频会话启用缓存前后的成本差\"]"
  },
  {
   "id": "3752d1ad-a924-4be5-9b73-ec69b9cd0075",
   "tree_id": "9369e054-3c40-4a46-9952-3abbde4195a1",
   "title": "Agent 心智模型：workflow vs agent",
   "description": "以 Anthropic《Building Effective Agents》为骨架，建立 workflow 与 agent 的心智模型、5 类 workflow 与选型框架。",
   "icon": "lightbulb",
   "category": "Agent 核心",
   "difficulty": 2,
   "estimated_minutes": 150,
   "depth_level": 4,
   "position_x": 0.0,
   "position_y": 0.0,
   "order_in_level": 0,
   "learning_objectives": "[\"能区分 workflow 与 agent 并给出各自适用场景\", \"能画出 agent 循环的状态图\"]",
   "key_concepts": "[\"workflow vs agent\", \"5 类 workflow 模式\", \"agent 循环：模型+工具+观察\"]",
   "recommended_depth": "Understand",
   "depth_rationale": "这是本树的概念核心，选型比实现更重要；官方推荐先读此篇再学任何框架。",
   "observable_evidence": "[\"用自己的话总结 Building Effective Agents 的 5 类 workflow\", \"给一个真实任务判断该用 workflow 还是 agent\"]"
  },
  {
   "id": "d5737471-c58a-420a-8783-749a3c20b01d",
   "tree_id": "9369e054-3c40-4a46-9952-3abbde4195a1",
   "title": "工具调用协议深度",
   "description": "深入理解工具调用协议：工具定义 schema、tool_use/tool_result 消息往返、多工具并行、失败与异常处理。",
   "icon": "tool",
   "category": "Agent 核心",
   "difficulty": 3,
   "estimated_minutes": 180,
   "depth_level": 4,
   "position_x": 0.0,
   "position_y": 0.0,
   "order_in_level": 0,
   "learning_objectives": "[\"能实现从工具定义到结果回填的完整调用链\", \"能处理工具调用失败与异常输入\"]",
   "key_concepts": "[\"工具定义 schema\", \"tool_use 与 tool_result 往返\", \"并行工具调用与失败处理\"]",
   "recommended_depth": "Use",
   "depth_rationale": "工具调用是 Agent 与外部世界交互的唯一通道，所有框架都建立在这条协议之上。",
   "observable_evidence": "[\"裸 SDK 实现一次完整工具调用链（不经框架）\", \"设计一个工具并演示异常输入的处理\"]"
  },
  {
   "id": "f0a93088-309f-4d7e-aa0b-01cb2086c6c2",
   "tree_id": "9369e054-3c40-4a46-9952-3abbde4195a1",
   "title": "手写 Agent 循环与终止保护",
   "description": "手写最小 Agent 循环：模型决策 → 执行工具 → 观察结果 → 再次决策；循环终止条件与最大步数保护。",
   "icon": "code",
   "category": "Agent 核心",
   "difficulty": 3,
   "estimated_minutes": 180,
   "depth_level": 4,
   "position_x": 0.0,
   "position_y": 0.0,
   "order_in_level": 0,
   "learning_objectives": "[\"能手写一个最小 Agent 循环并跑通真实任务\", \"能设计循环终止与最大轮数保护\"]",
   "key_concepts": "[\"循环结构与终止条件\", \"最大步数与超时保护\", \"观察回填\"]",
   "recommended_depth": "Use",
   "depth_rationale": "框架只是把这条循环工程化；手写一遍才能真正理解 LangGraph 在做什么。",
   "observable_evidence": "[\"手写 30 行以内的 agent 循环完成一个真实任务\", \"解释循环为什么必须有终止保护\"]"
  },
  {
   "id": "1bcf6b77-3954-46ab-8d50-de7ef2516cb1",
   "tree_id": "9369e054-3c40-4a46-9952-3abbde4195a1",
   "title": "结构化输出与工具契约设计",
   "description": "掌握强制结构化输出：JSON mode、工具约束、Pydantic 输出解析，工具/输出契约的类型设计。",
   "icon": "shield",
   "category": "Agent 核心",
   "difficulty": 3,
   "estimated_minutes": 150,
   "depth_level": 4,
   "position_x": 0.0,
   "position_y": 0.0,
   "order_in_level": 0,
   "learning_objectives": "[\"能强制模型输出符合 schema 的结构化数据\", \"能设计工具/输出的类型契约\"]",
   "key_concepts": "[\"JSON mode 与工具约束\", \"Pydantic 输出解析\", \"输出校验与重试\"]",
   "recommended_depth": "Use",
   "depth_rationale": "不可靠输出是 Agent 失败主因之一；结构化契约是把 Agent 接入系统的前提。",
   "observable_evidence": "[\"让模型输出严格符合 Pydantic schema 并校验\", \"设计重试机制处理解析失败\"]"
  },
  {
   "id": "fc50e141-603a-4910-a912-f0acc063c5c3",
   "tree_id": "9369e054-3c40-4a46-9952-3abbde4195a1",
   "title": "Agent 安全：注入与权限边界",
   "description": "理解 prompt injection、工具滥用与不可信内容：隔离策略、权限最小化、输出处理与审计。",
   "icon": "shield",
   "category": "Agent 核心",
   "difficulty": 3,
   "estimated_minutes": 150,
   "depth_level": 4,
   "position_x": 0.0,
   "position_y": 0.0,
   "order_in_level": 0,
   "learning_objectives": "[\"能识别并防御常见注入攻击\", \"能设计工具执行的权限边界\"]",
   "key_concepts": "[\"prompt injection\", \"工具权限最小化\", \"不可信内容隔离\"]",
   "recommended_depth": "Understand",
   "depth_rationale": "Agent 会执行工具，安全边界从第一天就要建立，不能等上线后补救。",
   "observable_evidence": "[\"演示一个注入攻击并给出防御方案\", \"给工具设计权限清单并解释每项的理由\"]"
  },
  {
   "id": "66fe0ed1-472a-4972-9e99-5d2121a7675f",
   "tree_id": "9369e054-3c40-4a46-9952-3abbde4195a1",
   "title": "MCP 协议：架构与概念",
   "description": "理解 Model Context Protocol：动机、客户端-服务器架构、三类原语（工具/资源/提示）、传输与认证。",
   "icon": "compass",
   "category": "Agent 核心",
   "difficulty": 3,
   "estimated_minutes": 150,
   "depth_level": 4,
   "position_x": 0.0,
   "position_y": 0.0,
   "order_in_level": 0,
   "learning_objectives": "[\"能解释 MCP 解决什么问题\", \"能区分工具/资源/提示三类原语\"]",
   "key_concepts": "[\"MCP 架构与动机\", \"工具/资源/提示原语\", \"客户端-服务器与传输\"]",
   "recommended_depth": "Understand",
   "depth_rationale": "MCP 是 2026 年 Agent 生态的核心协议，官方课程与社区路线均独立成模块。",
   "observable_evidence": "[\"画图解释 MCP 客户端-服务器交互\", \"对比 MCP 工具与原生 function calling 的取舍\"]"
  },
  {
   "id": "9ac22267-cfef-44de-80b9-dbacfbdb5bb9",
   "tree_id": "9369e054-3c40-4a46-9952-3abbde4195a1",
   "title": "MCP 实战：自建 MCP Server",
   "description": "用 MCP Python SDK 实现 Server：工具注册、参数 schema、资源暴露、与客户端连接调试。",
   "icon": "rocket",
   "category": "Agent 核心",
   "difficulty": 3,
   "estimated_minutes": 180,
   "depth_level": 4,
   "position_x": 0.0,
   "position_y": 0.0,
   "order_in_level": 0,
   "learning_objectives": "[\"能实现一个可用的 MCP Server\", \"能从客户端调用自建工具\"]",
   "key_concepts": "[\"MCP Python SDK\", \"工具与资源实现\", \"本地与远程连接\"]",
   "recommended_depth": "Use",
   "depth_rationale": "生产 Agent 的工具生态正在向 MCP 迁移，动手实现是掌握协议的最佳路径。",
   "observable_evidence": "[\"实现一个含 2 个工具的 MCP Server 并接入客户端调用\", \"给工具加输入校验与错误处理\"]"
  },
  {
   "id": "ab46b258-1695-430c-86fc-9c9880b9ff85",
   "tree_id": "9369e054-3c40-4a46-9952-3abbde4195a1",
   "title": "LangChain 架构与组件分层",
   "description": "理解 LangChain 的整体架构：Model I/O、Retrieval、Memory、Agent、Callbacks 五大模块的职责与协作。",
   "icon": "layers",
   "category": "LangChain",
   "difficulty": 2,
   "estimated_minutes": 150,
   "depth_level": 5,
   "position_x": 0.0,
   "position_y": 0.0,
   "order_in_level": 0,
   "learning_objectives": "[\"能画出 LangChain 六大核心组件的协作图\", \"能说出每个组件解决的具体问题\"]",
   "key_concepts": "[\"模型 I/O 层\", \"检索层与记忆层\", \"回调与可观测性\"]",
   "recommended_depth": "Understand",
   "depth_rationale": "LangChain 是 2026 年 Agent 应用最主流的框架，理解其分层才能读懂生态文档与生产事故排查。",
   "observable_evidence": "[\"画组件分层图并标注数据流向\", \"对比 LangChain 各层与 FastAPI 中间件/路由的职责划分\"]"
  },
  {
   "id": "c554bfc5-ee7b-4d17-9ca7-a67e7ee22cb5",
   "tree_id": "9369e054-3c40-4a46-9952-3abbde4195a1",
   "title": "LCEL 与 Runnable 协议",
   "description": "掌握 LCEL 声明式组合与 Runnable 协议：invoke/batch/stream、管道运算符、异步变体、与旧版 Chain 的本质区别。",
   "icon": "link",
   "category": "LangChain",
   "difficulty": 2,
   "estimated_minutes": 180,
   "depth_level": 5,
   "position_x": 0.0,
   "position_y": 0.0,
   "order_in_level": 0,
   "learning_objectives": "[\"能写出一个可运行、可流式、可批处理的 LCEL 管道\", \"能解释 LCEL 与函数式调用在设计上的区别\"]",
   "key_concepts": "[\"Runnable 协议与 invoke/batch/stream\", \"管道组合与重试\", \"流式与异步接口\"]",
   "recommended_depth": "Use",
   "depth_rationale": "LCEL 是 LangChain v1 的架构核心，社区路线普遍认为这是 LangChain 最值得深挖的部分。",
   "observable_evidence": "[\"用 LCEL 组合『检索→提示→模型→解析』管道并流式输出\", \"给管道加错误重试与超时配置\"]"
  },
  {
   "id": "85f20b67-3dc7-4fb0-95b7-5432881e919c",
   "tree_id": "9369e054-3c40-4a46-9952-3abbde4195a1",
   "title": "Runnable 高级：并行、批处理与回退",
   "description": "掌握 Runnable 的并发原语：RunnableParallel、RunnableMap、RunnableLambda 与重试/回退机制。",
   "icon": "link",
   "category": "LangChain",
   "difficulty": 2,
   "estimated_minutes": 180,
   "depth_level": 5,
   "position_x": 0.0,
   "position_y": 0.0,
   "order_in_level": 0,
   "learning_objectives": "[\"能用 RunnableParallel 并行调用多个模型或检索器\", \"能配置 fallback 链保证服务可用性\"]",
   "key_concepts": "[\"RunnableParallel 并行\", \"RunnableLambda 适配\", \"重试与 fallback\"]",
   "recommended_depth": "Use",
   "depth_rationale": "生产 Agent 的延迟与可用性优化全部依赖这些原语，浅尝辄止无法写出稳定应用。",
   "observable_evidence": "[\"实现并行『摘要+关键词』双路调用并合并结果\", \"配置带 fallback 的模型调用链\"]"
  },
  {
   "id": "bbd918de-245b-4835-a5fd-763ec7fb8692",
   "tree_id": "9369e054-3c40-4a46-9952-3abbde4195a1",
   "title": "Chat Models 深入：消息角色与绑定工具",
   "description": "深入 Chat Models 接口：消息角色语义（system/user/assistant/tool）、bind_tools、多模型切换与供应商差异。",
   "icon": "message",
   "category": "LangChain",
   "difficulty": 2,
   "estimated_minutes": 180,
   "depth_level": 5,
   "position_x": 0.0,
   "position_y": 0.0,
   "order_in_level": 0,
   "learning_objectives": "[\"能构造多角色对话消息并解释工具调用消息流\", \"能在同一接口下切换不同供应商模型\"]",
   "key_concepts": "[\"消息角色与对话状态\", \"bind_tools 工具绑定\", \"模型供应商适配层\"]",
   "recommended_depth": "Use",
   "depth_rationale": "工具调用消息流是 Agent 循环的基础，角色语义理解错误会导致最隐蔽的 bug。",
   "observable_evidence": "[\"实现带工具回调的多轮对话并观察消息历史\", \"对比两个供应商模型在同一接口下的行为差异\"]"
  },
  {
   "id": "8925f021-1a1c-4baf-8d5d-1f90435f9f81",
   "tree_id": "9369e054-3c40-4a46-9952-3abbde4195a1",
   "title": "Prompt Templates 深入",
   "description": "掌握提示模板工程：ChatPromptTemplate、MessagePlaceholder、部分填充、模板版本化与提示管理。",
   "icon": "template",
   "category": "LangChain",
   "difficulty": 2,
   "estimated_minutes": 150,
   "depth_level": 5,
   "position_x": 0.0,
   "position_y": 0.0,
   "order_in_level": 0,
   "learning_objectives": "[\"能用 MessagePlaceholder 构造动态工具历史\", \"能设计可版本化的提示模板体系\"]",
   "key_concepts": "[\"ChatPromptTemplate 与占位符\", \"提示版本管理与回滚\", \"模板与函数组合\"]",
   "recommended_depth": "Use",
   "depth_rationale": "提示是 Agent 的灵魂，社区实践强调模板必须可版本化、可测试，与代码同生命周期。",
   "observable_evidence": "[\"实现带会话历史占位的提示模板\", \"为提示模板写单元测试并演示回滚场景\"]"
  },
  {
   "id": "8df58799-9428-4663-a1e7-b171b6c8991d",
   "tree_id": "9369e054-3c40-4a46-9952-3abbde4195a1",
   "title": "输出解析与 with_structured_output",
   "description": "掌握结构化输出：PydanticOutputParser、with_structured_output、JSON 修复（输出修复器）与类型保障。",
   "icon": "output",
   "category": "LangChain",
   "difficulty": 2,
   "estimated_minutes": 180,
   "depth_level": 5,
   "position_x": 0.0,
   "position_y": 0.0,
   "order_in_level": 0,
   "learning_objectives": "[\"能让模型稳定输出 Pydantic 校验通过的对象\", \"能处理模型输出格式错误的恢复流程\"]",
   "key_concepts": "[\"with_structured_output\", \"输出修复与重试\", \"JSON Schema 与 Pydantic\"]",
   "recommended_depth": "Use",
   "depth_rationale": "Agent 与外部系统（工具、数据库、前端）的接口全部依赖结构化输出，是生产级的硬要求。",
   "observable_evidence": "[\"实现模型→Pydantic 模型的强制结构化输出\", \"演示一次格式错误后的自动修复流程\"]"
  },
  {
   "id": "07cc5008-e535-4871-8c6b-6a9e0bad1608",
   "tree_id": "9369e054-3c40-4a46-9952-3abbde4195a1",
   "title": "Tools 与 Toolkits 深度",
   "description": "掌握 @tool 装饰器体系：参数校验、异步工具、错误处理策略、ToolNode 与工具生命周期。",
   "icon": "wrench",
   "category": "LangChain",
   "difficulty": 2,
   "estimated_minutes": 180,
   "depth_level": 5,
   "position_x": 0.0,
   "position_y": 0.0,
   "order_in_level": 0,
   "learning_objectives": "[\"能写带复杂参数校验与错误处理的工具\", \"能组合多个工具成 Toolkits 并在 Agent 中使用\"]",
   "key_concepts": "[\"@tool 与参数 schema\", \"异步工具与超时\", \"工具错误处理与重试\"]",
   "recommended_depth": "Use",
   "depth_rationale": "工具质量直接决定 Agent 能力边界，官方文档与社区都强调工具是 Agent 应用的核心资产。",
   "observable_evidence": "[\"实现 3 个生产级工具（含校验、重试、日志）\", \"用一个 Agent 组合调用多个工具完成任务\"]"
  },
  {
   "id": "94109979-e70d-401b-9d14-05eb9c26fcec",
   "tree_id": "9369e054-3c40-4a46-9952-3abbde4195a1",
   "title": "Memory 体系：会话记忆",
   "description": "理解对话记忆机制：消息历史、摘要压缩、长期向量记忆与记忆的持久化边界（与 Chat History 存储分离）。",
   "icon": "database",
   "category": "LangChain",
   "difficulty": 2,
   "estimated_minutes": 120,
   "depth_level": 5,
   "position_x": 0.0,
   "position_y": 0.0,
   "order_in_level": 0,
   "learning_objectives": "[\"能设计会话记忆的存取与清理策略\", \"能区分短期上下文与长期记忆的存储选择\"]",
   "key_concepts": "[\"消息历史管理\", \"摘要与压缩策略\", \"向量记忆与持久化\"]",
   "recommended_depth": "Understand",
   "depth_rationale": "记忆是 Agent 体验的关键，但滥用会导致上下文爆炸与成本失控，需要明确边界。",
   "observable_evidence": "[\"实现带摘要压缩的多轮记忆会话\", \"分析长对话下记忆方案的取舍并给出方案\"]"
  },
  {
   "id": "a74d8a3d-39ce-45af-bf94-02d07d57457f",
   "tree_id": "9369e054-3c40-4a46-9952-3abbde4195a1",
   "title": "Model Routing 与多模型编排",
   "description": "理解多模型路由：按任务/成本/延迟选择模型、模型降级策略与 LangChain 的模型路由能力。",
   "icon": "compass",
   "category": "LangChain",
   "difficulty": 2,
   "estimated_minutes": 120,
   "depth_level": 5,
   "position_x": 0.0,
   "position_y": 0.0,
   "order_in_level": 0,
   "learning_objectives": "[\"能设计按任务类型路由模型的策略\", \"能解释模型降级对可用性的意义\"]",
   "key_concepts": "[\"模型路由策略\", \"成本与延迟权衡\", \"降级与容错\"]",
   "recommended_depth": "Understand",
   "depth_rationale": "生产应用必然面临多模型编排与降级问题，这是 190 小时主线中衔接『工程化』的一环。",
   "observable_evidence": "[\"设计一个任务→模型路由表并论证选择\", \"实现简单降级链并测试故障切换\"]"
  },
  {
   "id": "595120ec-815a-432e-93d3-b747575ec5d3",
   "tree_id": "9369e054-3c40-4a46-9952-3abbde4195a1",
   "title": "create_agent 与生产配置",
   "description": "使用 LangChain 高层 Agent 构造器：create_agent/create_react_agent，理解其内部如何组合 LCEL、工具与记忆。",
   "icon": "rocket",
   "category": "LangChain",
   "difficulty": 2,
   "estimated_minutes": 180,
   "depth_level": 5,
   "position_x": 0.0,
   "position_y": 0.0,
   "order_in_level": 0,
   "learning_objectives": "[\"能用 create_agent 快速构造可用 Agent\", \"能读懂其生成的内部结构与执行流程\"]",
   "key_concepts": "[\"create_agent API\", \"内部组件组合\", \"生产参数调优\"]",
   "recommended_depth": "Use",
   "depth_rationale": "高层 API 是脚手架，读懂内部结构才是深度所在；两者都掌握才算会用。",
   "observable_evidence": "[\"用 create_agent 构造工具型 Agent 并演示完整流程\", \"剖析其内部执行链并解释每层职责\"]"
  },
  {
   "id": "d7807681-8856-4974-afd1-309b761dbdd1",
   "tree_id": "9369e054-3c40-4a46-9952-3abbde4195a1",
   "title": "LangGraph 入门：StateGraph 与状态",
   "description": "理解 LangGraph 核心概念：状态定义（State）、节点函数、图的构建与编译、与 LCEL 管道的区别。",
   "icon": "workflow",
   "category": "LangGraph",
   "difficulty": 2,
   "estimated_minutes": 150,
   "depth_level": 6,
   "position_x": 0.0,
   "position_y": 0.0,
   "order_in_level": 0,
   "learning_objectives": "[\"能定义带 TypedDict 状态的图并运行\", \"能解释状态在节点间的传递方式\"]",
   "key_concepts": "[\"StateGraph 与 TypedDict 状态\", \"节点函数契约\", \"图编译与执行\"]",
   "recommended_depth": "Understand",
   "depth_rationale": "LangGraph 是 2026 年构建生产级 Agent 的主流底层框架，官方教程已将其作为默认 Agent 构建方式。",
   "observable_evidence": "[\"实现一个 3 节点的状态图并打印每步状态\", \"对比 LangGraph 图与 LCEL 管道的适用场景\"]"
  },
  {
   "id": "a402ede0-a5ec-4334-9f09-c66a74d93530",
   "tree_id": "9369e054-3c40-4a46-9952-3abbde4195a1",
   "title": "节点、边与条件路由",
   "description": "掌握图的连接方式：普通边、条件边、START/END 节点、路由函数与循环控制的正确姿势。",
   "icon": "workflow",
   "category": "LangGraph",
   "difficulty": 2,
   "estimated_minutes": 180,
   "depth_level": 6,
   "position_x": 0.0,
   "position_y": 0.0,
   "order_in_level": 0,
   "learning_objectives": "[\"能实现条件路由实现『工具→结果→决策』循环\", \"能设计避免死循环的终止条件\"]",
   "key_concepts": "[\"普通边与条件边\", \"路由函数与决策逻辑\", \"循环与终止控制\"]",
   "recommended_depth": "Use",
   "depth_rationale": "Agent 的本质是有环图，条件路由是让图『活』起来的关键机制。",
   "observable_evidence": "[\"实现一个带工具循环的 ReAct 风格图\", \"给图加循环上限与异常分支\"]"
  },
  {
   "id": "abc9dac9-76fb-4b68-b71e-3e9fefd87d16",
   "tree_id": "9369e054-3c40-4a46-9952-3abbde4195a1",
   "title": "Checkpoint：状态持久化",
   "description": "理解 Checkpointer 机制：状态快照、线程（thread_id）、断点恢复与持久化后端选择。",
   "icon": "database",
   "category": "LangGraph",
   "difficulty": 2,
   "estimated_minutes": 120,
   "depth_level": 6,
   "position_x": 0.0,
   "position_y": 0.0,
   "order_in_level": 0,
   "learning_objectives": "[\"能用 thread_id 实现会话级状态隔离\", \"能解释 checkpoint 与数据库存状态的取舍\"]",
   "key_concepts": "[\"checkpointer 与线程\", \"状态快照与恢复\", \"持久化后端\"]",
   "recommended_depth": "Understand",
   "depth_rationale": "生产 Agent 必须支持恢复与审计，checkpoint 是 LangGraph 区别于其他编排框架的核心特性。",
   "observable_evidence": "[\"实现多线程会话各自独立的对话状态\", \"模拟进程重启后从 checkpoint 恢复对话\"]"
  },
  {
   "id": "1c738dd7-49e4-43df-bc98-b69e1953672e",
   "tree_id": "9369e054-3c40-4a46-9952-3abbde4195a1",
   "title": "interrupt：人机交互断点",
   "description": "掌握 interrupt 机制：让图在关键步骤暂停等待人工确认（审批、纠错、敏感操作确认）。",
   "icon": "pause",
   "category": "LangGraph",
   "difficulty": 2,
   "estimated_minutes": 120,
   "depth_level": 6,
   "position_x": 0.0,
   "position_y": 0.0,
   "order_in_level": 0,
   "learning_objectives": "[\"能实现人工审批节点并恢复执行\", \"能区分 interrupt 与普通等待的区别\"]",
   "key_concepts": "[\"interrupt 与恢复\", \"人工审批流程\", \"敏感操作确认\"]",
   "recommended_depth": "Understand",
   "depth_rationale": "Agent 不能完全无人值守，人工介入点是生产部署的必备能力（如转账审批）。",
   "observable_evidence": "[\"实现一个需要人工确认后才能继续的工具调用\", \"演示中断后恢复执行的全过程\"]"
  },
  {
   "id": "737373a4-e2bd-4029-a047-12e773ca4c27",
   "tree_id": "9369e054-3c40-4a46-9952-3abbde4195a1",
   "title": "流式事件与逐步调试",
   "description": "掌握 astream_events/astream 系列 API：观察节点级事件流、调试图执行、流式输出给前端。",
   "icon": "radio",
   "category": "LangGraph",
   "difficulty": 2,
   "estimated_minutes": 120,
   "depth_level": 6,
   "position_x": 0.0,
   "position_y": 0.0,
   "order_in_level": 0,
   "learning_objectives": "[\"能流式接收节点级事件并转发给前端\", \"能用事件流定位执行顺序问题\"]",
   "key_concepts": "[\"astream_events 事件流\", \"节点级调试\", \"前后端流式对接\"]",
   "recommended_depth": "Understand",
   "depth_rationale": "生产 Agent 的前端体验与排障全部依赖事件流，这是从玩具到产品的分水岭。",
   "observable_evidence": "[\"把图的事件流转发给前端实现打字机效果\", \"用事件流排查一次节点执行顺序异常\"]"
  },
  {
   "id": "116ee060-2637-42c3-822c-261f2e47680a",
   "tree_id": "9369e054-3c40-4a46-9952-3abbde4195a1",
   "title": "Subgraph：子图与图组合",
   "description": "理解子图机制：把复杂图拆成可复用子图、父子图状态映射、跨图共享 checkpoint。",
   "icon": "layers",
   "category": "LangGraph",
   "difficulty": 2,
   "estimated_minutes": 150,
   "depth_level": 6,
   "position_x": 0.0,
   "position_y": 0.0,
   "order_in_level": 0,
   "learning_objectives": "[\"能把大图拆分为带清晰接口的子图\", \"能解释子图间状态映射规则\"]",
   "key_concepts": "[\"子图定义与嵌套\", \"父子状态映射\", \"子图复用与测试\"]",
   "recommended_depth": "Understand",
   "depth_rationale": "复杂 Agent 必然需要模块化，子图是 LangGraph 的工程化核心，社区路线明确列为深挖点。",
   "observable_evidence": "[\"把 ReAct 循环封装为子图并在两个父图中复用\", \"绘制父子图的状态流图\"]"
  },
  {
   "id": "a4a41a3b-b8ff-43e7-a5fb-a628caa31ea5",
   "tree_id": "9369e054-3c40-4a46-9952-3abbde4195a1",
   "title": "Time Travel：时间旅行调试",
   "description": "理解基于 checkpoint 的时间旅行：回滚到任意历史状态、分叉调试与状态回溯。",
   "icon": "history",
   "category": "LangGraph",
   "difficulty": 2,
   "estimated_minutes": 90,
   "depth_level": 6,
   "position_x": 0.0,
   "position_y": 0.0,
   "order_in_level": 0,
   "learning_objectives": "[\"能回滚到历史节点并重放\", \"能利用分叉机制调试 Agent 决策\"]",
   "key_concepts": "[\"状态回溯与回滚\", \"分叉调试\", \"checkpoint 版本管理\"]",
   "recommended_depth": "Understand",
   "depth_rationale": "时间旅行是 LangGraph 独有的调试利器，能大幅降低 Agent 行为调试成本。",
   "observable_evidence": "[\"演示一次完整的时间旅行调试过程\", \"解释分叉状态在审计中的意义\"]"
  },
  {
   "id": "732ca740-748d-4071-9d67-866157566c10",
   "tree_id": "9369e054-3c40-4a46-9952-3abbde4195a1",
   "title": "多 Agent 编排",
   "description": "理解多 Agent 编排模式：主管-工人、网状协作、队列任务分发与共享状态设计。",
   "icon": "workflow",
   "category": "LangGraph",
   "difficulty": 2,
   "estimated_minutes": 150,
   "depth_level": 6,
   "position_x": 0.0,
   "position_y": 0.0,
   "order_in_level": 0,
   "learning_objectives": "[\"能实现主管-工人多 Agent 架构\", \"能设计多 Agent 间的任务划分与状态共享\"]",
   "key_concepts": "[\"主管-工人模式\", \"多 Agent 状态共享\", \"任务分发与合并\"]",
   "recommended_depth": "Understand",
   "depth_rationale": "复杂任务必然拆分为多 Agent 协作，官方文档有完整设计模式章节。",
   "observable_evidence": "[\"实现『主管调度+两个工人 Agent』的协作系统\", \"画出任务分发与结果合并的数据流\"]"
  },
  {
   "id": "3922cc55-5abd-4f19-80c3-81de97e4de30",
   "tree_id": "9369e054-3c40-4a46-9952-3abbde4195a1",
   "title": "ReAct 模式深入",
   "description": "深入 ReAct（Reason+Act）模式：思考-行动-观察循环的完整闭环、何时需要循环、何时停止。",
   "icon": "sync",
   "category": "Agent 模式",
   "difficulty": 2,
   "estimated_minutes": 180,
   "depth_level": 7,
   "position_x": 0.0,
   "position_y": 0.0,
   "order_in_level": 0,
   "learning_objectives": "[\"能手工实现 ReAct 循环并解释每一步\", \"能设计循环终止与防死循环策略\"]",
   "key_concepts": "[\"Reason+Act 循环\", \"思考-行动-观察闭环\", \"终止条件设计\"]",
   "recommended_depth": "Understand",
   "depth_rationale": "ReAct 是所有工具型 Agent 的理论基础，官方教程与论文都把它作为第一课。",
   "observable_evidence": "[\"不依赖框架手写一个 ReAct 循环\", \"对比手写循环与 LangGraph 实现的异同\"]"
  },
  {
   "id": "9aa64c18-206a-4854-8cde-b2a4079dcd5c",
   "tree_id": "9369e054-3c40-4a46-9952-3abbde4195a1",
   "title": "Reflection 反思模式",
   "description": "理解反思模式：生成→自我批评→改进的迭代循环、Critique 设计方法与质量提升的边界。",
   "icon": "refresh",
   "category": "Agent 模式",
   "difficulty": 2,
   "estimated_minutes": 150,
   "depth_level": 7,
   "position_x": 0.0,
   "position_y": 0.0,
   "order_in_level": 0,
   "learning_objectives": "[\"能实现生成-批评-改进循环\", \"能设计有效的批评提示\"]",
   "key_concepts": "[\"生成-批评-改进循环\", \"critique 设计\", \"质量边界与成本\"]",
   "recommended_depth": "Understand",
   "depth_rationale": "反思是提升输出质量的通用手段，社区共识认为成本与收益需要明确边界。",
   "observable_evidence": "[\"对一次代码生成任务应用反思循环并对比前后质量\", \"评估反思循环的成本收益\"]"
  },
  {
   "id": "83a0e6a6-1716-4587-8d43-d4b829b2f60c",
   "tree_id": "9369e054-3c40-4a46-9952-3abbde4195a1",
   "title": "Planning 规划模式",
   "description": "理解规划模式：任务分解（plan-then-execute）、规划器-执行器分离与规划失败时的重新规划。",
   "icon": "map",
   "category": "Agent 模式",
   "difficulty": 2,
   "estimated_minutes": 150,
   "depth_level": 7,
   "position_x": 0.0,
   "position_y": 0.0,
   "order_in_level": 0,
   "learning_objectives": "[\"能实现 plan-then-execute 架构\", \"能处理规划执行中的偏差与重新规划\"]",
   "key_concepts": "[\"plan-then-execute\", \"任务分解与执行\", \"重规划策略\"]",
   "recommended_depth": "Understand",
   "depth_rationale": "复杂任务的可靠完成依赖规划，Anthropic 官方教程将其列为多智能体工作流核心模式。",
   "observable_evidence": "[\"实现『规划器→执行器』并处理一次执行失败后的重规划\", \"对比规划模式与直接 ReAct 的适用场景\"]"
  },
  {
   "id": "2c8554fa-237a-4553-93d9-63fc7ca734d8",
   "tree_id": "9369e054-3c40-4a46-9952-3abbde4195a1",
   "title": "多 Agent 协作深入：编排模式对比",
   "description": "对比多 Agent 工作流五大模式：路由、并行化、编排者-工作者、评估者-优化者、自主协作的选型与代价。",
   "icon": "network",
   "category": "Agent 模式",
   "difficulty": 2,
   "estimated_minutes": 150,
   "depth_level": 7,
   "position_x": 0.0,
   "position_y": 0.0,
   "order_in_level": 0,
   "learning_objectives": "[\"能根据任务特征选择多 Agent 模式\", \"能说清每个模式的适用边界\"]",
   "key_concepts": "[\"五大协作模式\", \"模式选型与代价\", \"自主协作的失控风险\"]",
   "recommended_depth": "Understand",
   "depth_rationale": "Anthropic 官方《Building Effective Agents》明确强调『简单优先』，模式选型是高级决策能力。",
   "observable_evidence": "[\"为 3 个具体任务做模式选型并论证\", \"分析自主多 Agent 协作的失控风险与缓解\"]"
  },
  {
   "id": "13aa3a29-9022-44f5-8083-003dbee785fc",
   "tree_id": "9369e054-3c40-4a46-9952-3abbde4195a1",
   "title": "Agent 综合实战（一）：工具型 Agent 应用",
   "description": "综合运用 LangGraph + MCP + 结构化输出，构建一个完成真实业务任务（如智能客服/数据查询）的工具型 Agent。",
   "icon": "rocket",
   "category": "Agent 综合实战",
   "difficulty": 3,
   "estimated_minutes": 420,
   "depth_level": 7,
   "position_x": 0.0,
   "position_y": 0.0,
   "order_in_level": 0,
   "learning_objectives": "[\"交付一个可演示的完整 Agent 应用\", \"具备工具调用、记忆、人工介入、流式输出全部能力\"]",
   "key_concepts": "[\"完整 Agent 应用架构\", \"工具集成与记忆\", \"生产级打磨\"]",
   "recommended_depth": "Transfer",
   "depth_rationale": "所有深度理解都要在综合实战中落地，本节点是主线的第一个大型交付物。",
   "observable_evidence": "[\"交付含 5+ 工具、记忆、流式输出的完整应用\", \"编写项目 README 与架构说明\"]"
  },
  {
   "id": "b93cfacd-c356-42fb-b034-76583233b5e7",
   "tree_id": "9369e054-3c40-4a46-9952-3abbde4195a1",
   "title": "实战复盘：架构评审与迭代",
   "description": "复盘实战一：架构决策评审、性能与成本分析、失败案例整理、明确下一实战的改进点。",
   "icon": "history",
   "category": "Agent 综合实战",
   "difficulty": 2,
   "estimated_minutes": 180,
   "depth_level": 7,
   "position_x": 0.0,
   "position_y": 0.0,
   "order_in_level": 0,
   "learning_objectives": "[\"能对自己的架构做批判性评审\", \"能整理出可复用的模式与教训\"]",
   "key_concepts": "[\"架构评审方法\", \"成本与性能复盘\", \"经验沉淀\"]",
   "recommended_depth": "Transfer",
   "depth_rationale": "复盘是深度学习的放大器，社区大佬的学习路线普遍强调『做完必须复盘』。",
   "observable_evidence": "[\"输出一份架构评审报告\", \"列出下一实战的 5 个改进点\"]"
  },
  {
   "id": "739ec377-299e-4490-ab09-9870f2500e95",
   "tree_id": "9369e054-3c40-4a46-9952-3abbde4195a1",
   "title": "机器学习基础概念（了解）",
   "description": "了解 ML 基础术语：模型、训练/推理、过拟合、损失函数、监督/无监督/强化学习的边界。",
   "icon": "brain",
   "category": "ML 基础",
   "difficulty": 1,
   "estimated_minutes": 120,
   "depth_level": 8,
   "position_x": 0.0,
   "position_y": 0.0,
   "order_in_level": 0,
   "learning_objectives": "[\"能看懂 LLM 论文与文档中的 ML 术语\", \"能说清训练与推理的区别\"]",
   "key_concepts": "[\"训练与推理\", \"过拟合与损失函数\", \"监督/无监督/RL 边界\"]",
   "recommended_depth": "Recognize",
   "depth_rationale": "本节点只建认知不深入——Nest 后端经验里的『模型=API』心智在此补全，为理解采样、微调与评测打底。",
   "observable_evidence": "[\"用自己的话解释训练与推理的区别\", \"给 3 个术语写一句话定义（训练/过拟合/损失）\"]"
  },
  {
   "id": "f9c8a315-ef63-4894-a2a6-995651fe4ce1",
   "tree_id": "9369e054-3c40-4a46-9952-3abbde4195a1",
   "title": "向量与嵌入（了解）",
   "description": "了解嵌入（Embedding）的概念：文本如何变成向量、语义相似度计算、维度与模型选型的直觉。",
   "icon": "cube",
   "category": "ML 基础",
   "difficulty": 1,
   "estimated_minutes": 120,
   "depth_level": 8,
   "position_x": 0.0,
   "position_y": 0.0,
   "order_in_level": 0,
   "learning_objectives": "[\"能解释嵌入在高维空间中的语义表示\", \"能说出相似度计算的直觉原理\"]",
   "key_concepts": "[\"嵌入与语义空间\", \"余弦相似度\", \"嵌入模型选型\"]",
   "recommended_depth": "Recognize",
   "depth_rationale": "嵌入是 RAG 与向量记忆的基石，只要求建立直觉不要求推导数学。",
   "observable_evidence": "[\"用两个相似句子的向量演示语义相近\", \"解释为什么嵌入比词频更能代表语义\"]"
  },
  {
   "id": "9344203d-b978-40d9-b800-f8905dfb2481",
   "tree_id": "9369e054-3c40-4a46-9952-3abbde4195a1",
   "title": "模型微调概览（了解）",
   "description": "了解微调（Fine-tuning）的动机、流程与代价：为什么先提示工程后微调、RAG 与微调的分工。",
   "icon": "settings",
   "category": "ML 基础",
   "difficulty": 1,
   "estimated_minutes": 90,
   "depth_level": 8,
   "position_x": 0.0,
   "position_y": 0.0,
   "order_in_level": 0,
   "learning_objectives": "[\"能说清微调与提示工程的适用边界\", \"能评估一个场景是否需要微调\"]",
   "key_concepts": "[\"微调流程与数据\", \"与提示工程/RAG 的分工\", \"成本与维护代价\"]",
   "recommended_depth": "Recognize",
   "depth_rationale": "生产决策常涉及『要不要微调』，了解边界即可，深入微调属于后续主线。",
   "observable_evidence": "[\"为一个场景论证『应微调还是用 RAG/提示』\", \"列出微调的三大成本\"]"
  },
  {
   "id": "d6711889-c821-4f05-80d4-7e707e0c87d1",
   "tree_id": "9369e054-3c40-4a46-9952-3abbde4195a1",
   "title": "RAG 架构与完整流程",
   "description": "理解 RAG 全流程：索引（解析→分块→嵌入→入库）与检索（查询→召回→重排→生成），以及各环节的失效风险。",
   "icon": "layers",
   "category": "RAG",
   "difficulty": 2,
   "estimated_minutes": 120,
   "depth_level": 9,
   "position_x": 0.0,
   "position_y": 0.0,
   "order_in_level": 0,
   "learning_objectives": "[\"能画出 RAG 完整架构图\", \"能指出每个环节可能失效的位置\"]",
   "key_concepts": "[\"索引流水线\", \"检索-生成闭环\", \"失效风险分布\"]",
   "recommended_depth": "Understand",
   "depth_rationale": "RAG 是知识型 Agent 应用的事实标准，官方课程与社区路线均独立成章且标注为深挖重点。",
   "observable_evidence": "[\"画 RAG 全流程图并标注每环节风险\", \"分析一个真实 RAG 产品的环节缺陷\"]"
  },
  {
   "id": "0e7af60a-3595-4c1f-8c03-c7f7e116e36f",
   "tree_id": "9369e054-3c40-4a46-9952-3abbde4195a1",
   "title": "文档解析与分块策略",
   "description": "掌握文档解析与分块：Markdown/PDF 解析器选择、按标题/语义/固定长度的分块策略与元数据保留。",
   "icon": "scissors",
   "category": "RAG",
   "difficulty": 2,
   "estimated_minutes": 180,
   "depth_level": 9,
   "position_x": 0.0,
   "position_y": 0.0,
   "order_in_level": 0,
   "learning_objectives": "[\"能针对不同文档类型选择解析与分块方案\", \"能论证分块大小对检索质量的影响\"]",
   "key_concepts": "[\"文档解析器\", \"分块策略与元数据\", \"分块质量评估\"]",
   "recommended_depth": "Use",
   "depth_rationale": "分块质量直接决定检索质量，是 RAG 中最容易被忽视却最影响效果的工程环节。",
   "observable_evidence": "[\"对同一文档用 3 种分块策略检索对比质量\", \"实现保留标题层级的分块\"]"
  },
  {
   "id": "23156b14-848f-4c20-8adc-49f9e5946485",
   "tree_id": "9369e054-3c40-4a46-9952-3abbde4195a1",
   "title": "Embedding 与向量数据库",
   "description": "掌握向量检索实践：嵌入模型选型、向量数据库（Chroma/Qdrant）接入、索引参数与过滤条件。",
   "icon": "database",
   "category": "RAG",
   "difficulty": 2,
   "estimated_minutes": 180,
   "depth_level": 9,
   "position_x": 0.0,
   "position_y": 0.0,
   "order_in_level": 0,
   "learning_objectives": "[\"能完成文档入库与相似度检索全流程\", \"能结合元数据过滤做精确检索\"]",
   "key_concepts": "[\"向量库接入\", \"索引与搜索参数\", \"元数据过滤\"]",
   "recommended_depth": "Use",
   "depth_rationale": "向量库是 RAG 的存储核心，选型与参数直接影响检索质量与成本。",
   "observable_evidence": "[\"用向量库实现含元数据过滤的检索服务\", \"对比不同距离度量的检索结果差异\"]"
  },
  {
   "id": "3ff7f0cc-69f8-4ee2-9aa0-6e7b683bef15",
   "tree_id": "9369e054-3c40-4a46-9952-3abbde4195a1",
   "title": "混合检索与重排序",
   "description": "掌握混合检索（关键词+向量）与重排序（RRF 融合、cross-encoder reranker）的完整链路。",
   "icon": "sort",
   "category": "RAG",
   "difficulty": 2,
   "estimated_minutes": 180,
   "depth_level": 9,
   "position_x": 0.0,
   "position_y": 0.0,
   "order_in_level": 0,
   "learning_objectives": "[\"能实现混合检索与结果融合\", \"能接入 reranker 并评估质量提升\"]",
   "key_concepts": "[\"混合检索与 RRF\", \"cross-encoder reranker\", \"检索质量评估\"]",
   "recommended_depth": "Use",
   "depth_rationale": "社区共识：纯向量检索难以满足生产质量，混合检索+重排是 2026 年的标准配置。",
   "observable_evidence": "[\"实现混合检索并量化对比纯向量检索\", \"接入 reranker 前后做一次质量对比\"]"
  },
  {
   "id": "48755817-a6f5-4028-b520-bfebc91b3a7e",
   "tree_id": "9369e054-3c40-4a46-9952-3abbde4195a1",
   "title": "查询改写与多查询检索",
   "description": "理解查询侧优化：查询改写（Rewrite）、多查询分解（Multi-Query）、HyDE 与查询意图理解。",
   "icon": "edit",
   "category": "RAG",
   "difficulty": 2,
   "estimated_minutes": 120,
   "depth_level": 9,
   "position_x": 0.0,
   "position_y": 0.0,
   "order_in_level": 0,
   "learning_objectives": "[\"能实现查询改写与多查询扩展\", \"能评估查询优化带来的收益\"]",
   "key_concepts": "[\"查询改写\", \"多查询分解\", \"HyDE 与意图理解\"]",
   "recommended_depth": "Understand",
   "depth_rationale": "用户查询与文档语言差异是检索失配的主因，查询侧优化是低成本高收益的杠杆。",
   "observable_evidence": "[\"实现改写+多查询并对比单查询检索质量\", \"分析一次失配检索的根因\"]"
  },
  {
   "id": "128edac4-11c7-4915-96d3-4c5a0199b85f",
   "tree_id": "9369e054-3c40-4a46-9952-3abbde4195a1",
   "title": "Prompt 组装与引用溯源",
   "description": "掌握生成侧工程：上下文组装、引用标注、『不知道就说不知道』的拒答设计与人机可验证性。",
   "icon": "link",
   "category": "RAG",
   "difficulty": 2,
   "estimated_minutes": 150,
   "depth_level": 9,
   "position_x": 0.0,
   "position_y": 0.0,
   "order_in_level": 0,
   "learning_objectives": "[\"能实现带引用标注的回答\", \"能设计拒绝回答与来源冲突处理\"]",
   "key_concepts": "[\"上下文组装与截断\", \"引用溯源\", \"拒答设计\"]",
   "recommended_depth": "Use",
   "depth_rationale": "RAG 的回答必须可溯源，这是生产产品与 Demo 的核心区别，也直接关系可信度。",
   "observable_evidence": "[\"实现带引用标注的问答应用\", \"设计来源冲突时的处理策略\"]"
  },
  {
   "id": "4969f6bd-144f-4bf1-a1c3-afc4fa7bc11b",
   "tree_id": "9369e054-3c40-4a46-9952-3abbde4195a1",
   "title": "Agentic RAG：检索进入 Agent 循环",
   "description": "理解 Agentic RAG：LLM 自主决定检索时机、检索工具化、多轮检索与自反思式检索（Self-RAG 思路）。",
   "icon": "workflow",
   "category": "RAG",
   "difficulty": 2,
   "estimated_minutes": 150,
   "depth_level": 9,
   "position_x": 0.0,
   "position_y": 0.0,
   "order_in_level": 0,
   "learning_objectives": "[\"能把检索封装为工具并接入 Agent 循环\", \"能设计『先查再答』的自主决策流程\"]",
   "key_concepts": "[\"检索工具化\", \"自主检索决策\", \"Self-RAG 思路\"]",
   "recommended_depth": "Understand",
   "depth_rationale": "固定流程 RAG 无法应对复杂问题，Agentic RAG 是 2026 年社区公认的进阶方向。",
   "observable_evidence": "[\"实现检索工具接入 LangGraph 的 Agent\", \"对比固定流程与自主检索的问答质量\"]"
  },
  {
   "id": "483d039e-7a01-44eb-b2de-a1f81a2cda56",
   "tree_id": "9369e054-3c40-4a46-9952-3abbde4195a1",
   "title": "RAG 评估与 RAGAS",
   "description": "掌握 RAG 评估体系：RAGAS 指标（忠实度/相关性/上下文精度/召回）、评估集构建与回归测试。",
   "icon": "gauge",
   "category": "RAG",
   "difficulty": 2,
   "estimated_minutes": 180,
   "depth_level": 9,
   "position_x": 0.0,
   "position_y": 0.0,
   "order_in_level": 0,
   "learning_objectives": "[\"能用 RAGAS 对 RAG 系统打分\", \"能构建评估集并建立回归机制\"]",
   "key_concepts": "[\"RAGAS 四大指标\", \"评估集构建\", \"评估自动化\"]",
   "recommended_depth": "Use",
   "depth_rationale": "没有评估就没有优化依据，社区路线明确把 RAG 评估列为深挖点，是工程师与玩具开发者的分界。",
   "observable_evidence": "[\"用 RAGAS 评估自己的 RAG 系统并给出优化点\", \"构建 20 条评估集并跑回归\"]"
  },
  {
   "id": "dfbe334a-07d2-4ffe-a935-acd06a32d63f",
   "tree_id": "9369e054-3c40-4a46-9952-3abbde4195a1",
   "title": "RAG 失败模式与调优",
   "description": "掌握 RAG 的典型失败模式：召回不全、上下文冲突、幻觉残留、时序错乱，以及对应的调优手段。",
   "icon": "bug",
   "category": "RAG",
   "difficulty": 2,
   "estimated_minutes": 120,
   "depth_level": 9,
   "position_x": 0.0,
   "position_y": 0.0,
   "order_in_level": 0,
   "learning_objectives": "[\"能诊断 RAG 失败并定位环节\", \"能给出针对性的调优方案\"]",
   "key_concepts": "[\"失败模式分类\", \"逐环节调优\", \"效果验证方法\"]",
   "recommended_depth": "Understand",
   "depth_rationale": "生产 RAG 问题大多可归因于少数已知模式，学会系统诊断比堆功能更有价值。",
   "observable_evidence": "[\"为 3 个失败案例做诊断并给出调优方案\", \"总结自己的 RAG 调优检查清单\"]"
  },
  {
   "id": "51b7bcbb-d95b-454b-8af8-89996287a486",
   "tree_id": "9369e054-3c40-4a46-9952-3abbde4195a1",
   "title": "RAG 综合实战：知识问答 Agent",
   "description": "综合运用 RAG 全链路（解析→分块→混合检索→重排→生成→溯源）+ RAGAS 评估，构建文档问答 Agent。",
   "icon": "rocket",
   "category": "RAG",
   "difficulty": 3,
   "estimated_minutes": 420,
   "depth_level": 9,
   "position_x": 0.0,
   "position_y": 0.0,
   "order_in_level": 0,
   "learning_objectives": "[\"交付带评估报告的完整 RAG 问答系统\", \"具备混合检索、溯源、拒答全部能力\"]",
   "key_concepts": "[\"全链路集成\", \"评估与迭代闭环\", \"工程化打磨\"]",
   "recommended_depth": "Transfer",
   "depth_rationale": "主线的第二个大型交付物，要求『先评估后优化』的工程闭环。",
   "observable_evidence": "[\"交付完整 RAG 问答应用+评估报告\", \"附 3 轮迭代的指标变化记录\"]"
  },
  {
   "id": "6e719622-0e6b-4692-9cea-46b2af689c40",
   "tree_id": "9369e054-3c40-4a46-9952-3abbde4195a1",
   "title": "评测工程化：离线与在线评估",
   "description": "掌握评测体系工程化：评估集管理、回归流水线、Golden Set、在线 A/B 与上线门槛。",
   "icon": "gauge",
   "category": "生产化",
   "difficulty": 2,
   "estimated_minutes": 150,
   "depth_level": 10,
   "position_x": 0.0,
   "position_y": 0.0,
   "order_in_level": 0,
   "learning_objectives": "[\"能搭建自动化评测流水线\", \"能制定上线质量门槛\"]",
   "key_concepts": "[\"回归流水线与 Golden Set\", \"在线 A/B 评估\", \"上线门槛设计\"]",
   "recommended_depth": "Use",
   "depth_rationale": "从『能跑』到『能上线』的分界是评测体系，这是生产级工程师的必备能力。",
   "observable_evidence": "[\"为已有应用搭建评测回归流水线\", \"制定一份上线检查清单\"]"
  },
  {
   "id": "66933d23-e251-427c-8fc0-51440664bca5",
   "tree_id": "9369e054-3c40-4a46-9952-3abbde4195a1",
   "title": "可观测性与日志追踪",
   "description": "理解 Agent 应用的可观测性：Token 用量与成本日志、LangSmith 类追踪、请求链路与异常监控。",
   "icon": "activity",
   "category": "生产化",
   "difficulty": 2,
   "estimated_minutes": 120,
   "depth_level": 10,
   "position_x": 0.0,
   "position_y": 0.0,
   "order_in_level": 0,
   "learning_objectives": "[\"能追踪一次 Agent 调用的完整链路\", \"能设计成本与用量监控面板\"]",
   "key_concepts": "[\"链路追踪（LangSmith 等）\", \"成本与用量监控\", \"异常与告警\"]",
   "recommended_depth": "Understand",
   "depth_rationale": "Agent 应用是异步多跳系统，没有可观测性就无法定位问题，与 NestJS 日志体系思路相通。",
   "observable_evidence": "[\"接入追踪工具查看一次调用的完整链路\", \"设计成本告警规则\"]"
  },
  {
   "id": "9f159526-96cb-41cf-9b05-788ec5566d7c",
   "tree_id": "9369e054-3c40-4a46-9952-3abbde4195a1",
   "title": "生产部署（了解）",
   "description": "了解生产部署要点：Docker 化、FastAPI 部署、并发与长连接、限流与扩容的基本思路。",
   "icon": "server",
   "category": "生产化",
   "difficulty": 2,
   "estimated_minutes": 120,
   "depth_level": 10,
   "position_x": 0.0,
   "position_y": 0.0,
   "order_in_level": 0,
   "learning_objectives": "[\"能理解部署拓扑并完成基础容器化\", \"能说出限流与扩容的基本策略\"]",
   "key_concepts": "[\"容器化与部署\", \"限流与扩容\", \"与 NestJS 部署的对照\"]",
   "recommended_depth": "Recognize",
   "depth_rationale": "部署细节在 NestJS 项目深入，本节点建立 Python 侧的部署对照认知即可。",
   "observable_evidence": "[\"完成应用的 Docker 化并本地跑通\", \"对照 NestJS 部署列出异同表\"]"
  },
  {
   "id": "739ba659-c247-4621-90db-4ca33d0575a4",
   "tree_id": "9369e054-3c40-4a46-9952-3abbde4195a1",
   "title": "生产安全与合规（了解）",
   "description": "了解 AI 应用的安全与合规基线：数据脱敏、日志隐私、内容过滤与合规红线（与后端安全课的对照）。",
   "icon": "shield",
   "category": "生产化",
   "difficulty": 2,
   "estimated_minutes": 90,
   "depth_level": 10,
   "position_x": 0.0,
   "position_y": 0.0,
   "order_in_level": 0,
   "learning_objectives": "[\"能识别常见隐私与合规风险\", \"能说出安全基线清单\"]",
   "key_concepts": "[\"数据脱敏与隐私\", \"内容安全过滤\", \"合规红线\"]",
   "recommended_depth": "Recognize",
   "depth_rationale": "安全要求已在 Agent 安全节点与 NestJS 课程覆盖细节，这里聚焦部署侧基线。",
   "observable_evidence": "[\"为应用做一次安全基线检查并输出清单\", \"列出 5 条合规红线\"]"
  },
  {
   "id": "1b6c5cc0-ed37-40c2-8f55-9af2f2f0c86e",
   "tree_id": "9369e054-3c40-4a46-9952-3abbde4195a1",
   "title": "性能优化与成本治理",
   "description": "掌握 LLM 应用性能与成本：缓存（语义缓存/前缀缓存）、批处理、模型分级与用量治理。",
   "icon": "trending",
   "category": "生产化",
   "difficulty": 2,
   "estimated_minutes": 120,
   "depth_level": 10,
   "position_x": 0.0,
   "position_y": 0.0,
   "order_in_level": 0,
   "learning_objectives": "[\"能设计缓存与批处理优化方案\", \"能建立成本治理机制\"]",
   "key_concepts": "[\"语义与前缀缓存\", \"批处理与并发\", \"成本治理与配额\"]",
   "recommended_depth": "Understand",
   "depth_rationale": "LLM 应用的边际成本显著，成本治理是生产应用能否持续运营的关键。",
   "observable_evidence": "[\"为已有应用设计缓存与分级方案\", \"制定月度成本预算与超支告警\"]"
  },
  {
   "id": "c8266c32-dea2-4694-8db9-22407d3a754c",
   "tree_id": "9369e054-3c40-4a46-9952-3abbde4195a1",
   "title": "LLM 应用安全加固",
   "description": "综合应用安全实践：输入净化、输出审核、工具白名单、敏感操作二次确认与审计日志。",
   "icon": "shield",
   "category": "生产化",
   "difficulty": 2,
   "estimated_minutes": 120,
   "depth_level": 10,
   "position_x": 0.0,
   "position_y": 0.0,
   "order_in_level": 0,
   "learning_objectives": "[\"能为 Agent 应用做端到端安全加固\", \"能设计安全测试方案\"]",
   "key_concepts": "[\"输入净化与输出审核\", \"工具白名单与二次确认\", \"审计与追溯\"]",
   "recommended_depth": "Understand",
   "depth_rationale": "把安全节点学到的原理落实为完整的生产加固方案，是交付前的必做项。",
   "observable_evidence": "[\"为实战应用做安全加固并演示攻击失败\", \"输出安全加固文档\"]"
  },
  {
   "id": "fd48fbae-c508-43b9-a7b0-6409a8fbae2b",
   "tree_id": "9369e054-3c40-4a46-9952-3abbde4195a1",
   "title": "毕业项目：成熟 AI Agent 应用",
   "description": "独立完成毕业项目：综合 Agent 核心 + MCP + LangGraph + RAG + 评测 + 生产化，交付一个成熟的 AI 应用。",
   "icon": "trophy",
   "category": "毕业项目",
   "difficulty": 3,
   "estimated_minutes": 600,
   "depth_level": 10,
   "position_x": 0.0,
   "position_y": 0.0,
   "order_in_level": 0,
   "learning_objectives": "[\"交付完整可部署的应用与文档\", \"具备评估报告与安全加固\", \"架构决策有依据\"]",
   "key_concepts": "[\"端到端产品设计\", \"全部技术栈综合运用\", \"工程文档与交付\"]",
   "recommended_depth": "Transfer",
   "depth_rationale": "毕业项目是 2 个月主线的验收物：能用全部所学独立交付一个成熟 AI Agent 应用。",
   "observable_evidence": "[\"交付完整项目（代码+文档+评估报告+部署方案）\", \"做一次 15 分钟项目答辩演示\"]"
  },
  {
   "id": "b3e45f22-457f-4d18-9e9c-fa5490c75d22",
   "tree_id": "9369e054-3c40-4a46-9952-3abbde4195a1",
   "title": "项目复盘与毕业评估",
   "description": "系统复盘整个学习路径：各节点知识在毕业项目中的落点、薄弱环节识别、后续学习路线规划。",
   "icon": "history",
   "category": "毕业项目",
   "difficulty": 2,
   "estimated_minutes": 180,
   "depth_level": 10,
   "position_x": 0.0,
   "position_y": 0.0,
   "order_in_level": 0,
   "learning_objectives": "[\"能评估自己各领域的真实掌握程度\", \"能制定下一阶段学习计划\"]",
   "key_concepts": "[\"知识落点复盘\", \"薄弱环节识别\", \"后续路线规划\"]",
   "recommended_depth": "Transfer",
   "depth_rationale": "复盘是主线收尾：把 74 个节点映射到项目中的实际落点，形成下一阶段路线。",
   "observable_evidence": "[\"输出学习复盘报告\", \"制定下一阶段 4 周学习计划\"]"
  }
 ],
 "edges": [
  {
   "id": "a979576f-0696-46c5-ab64-da4a3b11a111",
   "source_node_id": "d2e470c6-53fa-42d4-a76b-5e8e2bbeafdc",
   "target_node_id": "9342764f-dc9a-4dc1-a67a-d1aea8d506bf",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "be65b603-6a94-424b-97a9-a043e1459aab",
   "source_node_id": "9342764f-dc9a-4dc1-a67a-d1aea8d506bf",
   "target_node_id": "5601a744-824e-438e-b5c1-d7cb71738109",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "242371de-e876-4f69-9110-3c566757dce6",
   "source_node_id": "5601a744-824e-438e-b5c1-d7cb71738109",
   "target_node_id": "a0e1efda-207f-4d71-aa0d-880ba9459d9c",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "c2894907-6b87-471d-986d-3d5fbe34837c",
   "source_node_id": "a0e1efda-207f-4d71-aa0d-880ba9459d9c",
   "target_node_id": "7c19a329-ef4f-4184-8e68-25dc39d9cd36",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "5e3437ec-ae94-48a6-918c-cf21fc87729d",
   "source_node_id": "d2e470c6-53fa-42d4-a76b-5e8e2bbeafdc",
   "target_node_id": "60428e17-cbea-47f8-abe7-ad9836d507dc",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "a35de547-c183-49d0-aca9-8cc54877b076",
   "source_node_id": "5601a744-824e-438e-b5c1-d7cb71738109",
   "target_node_id": "20d55018-d087-4139-9b61-bd9f448b3e71",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "2f2c1d6e-53f7-4562-85bc-fb55b21a76cb",
   "source_node_id": "60428e17-cbea-47f8-abe7-ad9836d507dc",
   "target_node_id": "20d55018-d087-4139-9b61-bd9f448b3e71",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "3770b7dc-a4e9-462e-8fc1-873cd55720c9",
   "source_node_id": "d2e470c6-53fa-42d4-a76b-5e8e2bbeafdc",
   "target_node_id": "af2e6854-6767-4fe8-9ace-e65e801d91b8",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "c1caf33b-ee3a-4729-8045-21a7cfe9b02d",
   "source_node_id": "60428e17-cbea-47f8-abe7-ad9836d507dc",
   "target_node_id": "af2e6854-6767-4fe8-9ace-e65e801d91b8",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "e6a718fc-9a02-4b4a-a665-fd06b9f3e4c9",
   "source_node_id": "9342764f-dc9a-4dc1-a67a-d1aea8d506bf",
   "target_node_id": "0288aab3-c9d4-4892-8df7-8ea3146fc589",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "d3773230-3ad1-4aad-b7e8-8199f9dc82ec",
   "source_node_id": "0288aab3-c9d4-4892-8df7-8ea3146fc589",
   "target_node_id": "cca38f80-b13e-4cf3-abcd-42a62972e65e",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "5ba04325-8943-43e2-a064-cb38d82c959d",
   "source_node_id": "5601a744-824e-438e-b5c1-d7cb71738109",
   "target_node_id": "b77d7727-7c28-4600-b3fb-3b2be509caf2",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "1645ab02-a82b-4560-8b31-a757f1df01cb",
   "source_node_id": "af2e6854-6767-4fe8-9ace-e65e801d91b8",
   "target_node_id": "b77d7727-7c28-4600-b3fb-3b2be509caf2",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "37165f66-51d4-4f98-b7d8-671371fc87a4",
   "source_node_id": "a0e1efda-207f-4d71-aa0d-880ba9459d9c",
   "target_node_id": "3d6c07f7-db74-4e2a-9ed2-6c3e3f274971",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "33e433f7-3407-4f30-9656-8548a08f10a8",
   "source_node_id": "7c19a329-ef4f-4184-8e68-25dc39d9cd36",
   "target_node_id": "c351e62a-2075-4257-8fc0-40c69cf732d5",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "ae1bf629-2919-4e96-9a96-8f99c9d8093b",
   "source_node_id": "af2e6854-6767-4fe8-9ace-e65e801d91b8",
   "target_node_id": "08011079-802d-4d84-b916-fad4326c8d21",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "6aa03f5a-90ea-42b0-b55f-837fbf1f8949",
   "source_node_id": "0288aab3-c9d4-4892-8df7-8ea3146fc589",
   "target_node_id": "08011079-802d-4d84-b916-fad4326c8d21",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "bbbeaad7-1d76-4141-a3e2-f33ee8d179a3",
   "source_node_id": "7c19a329-ef4f-4184-8e68-25dc39d9cd36",
   "target_node_id": "6ee00efb-e9fb-4f53-9ccb-1969898d8b0d",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "6dd1782d-6835-48ca-89a5-1873d5bfc95e",
   "source_node_id": "6ee00efb-e9fb-4f53-9ccb-1969898d8b0d",
   "target_node_id": "4d9bfb2b-45a2-4665-8bec-698482d1d279",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "638c021f-738a-43fb-915f-0bde3d58a577",
   "source_node_id": "6ee00efb-e9fb-4f53-9ccb-1969898d8b0d",
   "target_node_id": "90a111bf-94dd-461d-84bf-28202ee189d3",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "af723c7d-16e8-4128-bd46-c7edb62d59a2",
   "source_node_id": "4d9bfb2b-45a2-4665-8bec-698482d1d279",
   "target_node_id": "b62cbb4f-735d-43c4-8735-dd1b5aebf371",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "035c7e24-fe89-45b7-9478-d1bf1d5c4f02",
   "source_node_id": "90a111bf-94dd-461d-84bf-28202ee189d3",
   "target_node_id": "b62cbb4f-735d-43c4-8735-dd1b5aebf371",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "4daffd16-89c1-4f64-8957-81a8f83bc88b",
   "source_node_id": "b62cbb4f-735d-43c4-8735-dd1b5aebf371",
   "target_node_id": "3f1f3348-a59e-4511-9111-7c09bdaf622f",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "5b826120-74c8-4b61-88a1-b130e487409f",
   "source_node_id": "3d6c07f7-db74-4e2a-9ed2-6c3e3f274971",
   "target_node_id": "3f1f3348-a59e-4511-9111-7c09bdaf622f",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "8d1faa7f-d95c-428b-ae88-6291ddfd7d68",
   "source_node_id": "b62cbb4f-735d-43c4-8735-dd1b5aebf371",
   "target_node_id": "44c17298-ff37-4f87-8ecc-40d02da79202",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "a153e5c8-a0d8-4119-92f3-0b34427e7a96",
   "source_node_id": "44c17298-ff37-4f87-8ecc-40d02da79202",
   "target_node_id": "0bc47c29-37d7-4108-977e-3bbbc27871d1",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "b0f52593-f33a-45d3-9b93-f898dbc631c5",
   "source_node_id": "b62cbb4f-735d-43c4-8735-dd1b5aebf371",
   "target_node_id": "198c0871-3f90-445f-98e7-a3c74145204f",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "05317e64-4580-4cb0-9ade-acd6a894263a",
   "source_node_id": "4d9bfb2b-45a2-4665-8bec-698482d1d279",
   "target_node_id": "198c0871-3f90-445f-98e7-a3c74145204f",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "c400206f-7562-42ad-a20f-9a33466afee5",
   "source_node_id": "0bc47c29-37d7-4108-977e-3bbbc27871d1",
   "target_node_id": "3752d1ad-a924-4be5-9b73-ec69b9cd0075",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "54079dd9-8e27-428d-bc16-080a2b2716fa",
   "source_node_id": "b62cbb4f-735d-43c4-8735-dd1b5aebf371",
   "target_node_id": "d5737471-c58a-420a-8783-749a3c20b01d",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "70e97b9a-c7e2-47cb-93c2-5d51ed704214",
   "source_node_id": "d5737471-c58a-420a-8783-749a3c20b01d",
   "target_node_id": "f0a93088-309f-4d7e-aa0b-01cb2086c6c2",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "5db2fbd4-3df5-433f-9a40-ba26a622bde6",
   "source_node_id": "f0a93088-309f-4d7e-aa0b-01cb2086c6c2",
   "target_node_id": "1bcf6b77-3954-46ab-8d50-de7ef2516cb1",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "af6f2c94-5711-44c0-bf47-df144ef576f8",
   "source_node_id": "1bcf6b77-3954-46ab-8d50-de7ef2516cb1",
   "target_node_id": "fc50e141-603a-4910-a912-f0acc063c5c3",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "3d76e61e-a5a6-4213-96dd-7f3deb0bf40c",
   "source_node_id": "d5737471-c58a-420a-8783-749a3c20b01d",
   "target_node_id": "66fe0ed1-472a-4972-9e99-5d2121a7675f",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "56d6ea97-76cd-424d-925f-f4712b97112b",
   "source_node_id": "66fe0ed1-472a-4972-9e99-5d2121a7675f",
   "target_node_id": "9ac22267-cfef-44de-80b9-dbacfbdb5bb9",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "466d039b-8b6c-42cd-b4fb-0e522041683f",
   "source_node_id": "3752d1ad-a924-4be5-9b73-ec69b9cd0075",
   "target_node_id": "ab46b258-1695-430c-86fc-9c9880b9ff85",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "b64cb135-b3de-4e3e-a296-1fbda140de3c",
   "source_node_id": "ab46b258-1695-430c-86fc-9c9880b9ff85",
   "target_node_id": "c554bfc5-ee7b-4d17-9ca7-a67e7ee22cb5",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "6572fbe1-b7b0-4ba7-9528-96e2f3a5b852",
   "source_node_id": "c554bfc5-ee7b-4d17-9ca7-a67e7ee22cb5",
   "target_node_id": "85f20b67-3dc7-4fb0-95b7-5432881e919c",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "99adf931-3765-4406-af37-7c74509312b3",
   "source_node_id": "c554bfc5-ee7b-4d17-9ca7-a67e7ee22cb5",
   "target_node_id": "bbd918de-245b-4835-a5fd-763ec7fb8692",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "639eff33-28ff-44bc-ae6d-a0f87a7cdd2a",
   "source_node_id": "b62cbb4f-735d-43c4-8735-dd1b5aebf371",
   "target_node_id": "bbd918de-245b-4835-a5fd-763ec7fb8692",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "7756527d-35d3-428e-8f2e-44d50a053ad8",
   "source_node_id": "c554bfc5-ee7b-4d17-9ca7-a67e7ee22cb5",
   "target_node_id": "8925f021-1a1c-4baf-8d5d-1f90435f9f81",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "0d3f6d7a-3912-4682-bc1b-bc1b8e45a725",
   "source_node_id": "8925f021-1a1c-4baf-8d5d-1f90435f9f81",
   "target_node_id": "8df58799-9428-4663-a1e7-b171b6c8991d",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "a5464c20-0678-4134-b6dd-33c2d8b2fe90",
   "source_node_id": "cca38f80-b13e-4cf3-abcd-42a62972e65e",
   "target_node_id": "8df58799-9428-4663-a1e7-b171b6c8991d",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "2d2d7e77-f6ef-4eb3-96ad-84f586162352",
   "source_node_id": "bbd918de-245b-4835-a5fd-763ec7fb8692",
   "target_node_id": "07cc5008-e535-4871-8c6b-6a9e0bad1608",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "e3728a0d-691b-492e-a095-a29c6e9af381",
   "source_node_id": "8df58799-9428-4663-a1e7-b171b6c8991d",
   "target_node_id": "07cc5008-e535-4871-8c6b-6a9e0bad1608",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "0e06d697-acaf-442d-8c17-460c132794b8",
   "source_node_id": "9ac22267-cfef-44de-80b9-dbacfbdb5bb9",
   "target_node_id": "07cc5008-e535-4871-8c6b-6a9e0bad1608",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "851c07db-2a8d-491e-a267-cfca7cf4abf9",
   "source_node_id": "bbd918de-245b-4835-a5fd-763ec7fb8692",
   "target_node_id": "94109979-e70d-401b-9d14-05eb9c26fcec",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "52f46d21-38bb-4905-bd91-82d8238dd19c",
   "source_node_id": "198c0871-3f90-445f-98e7-a3c74145204f",
   "target_node_id": "a74d8a3d-39ce-45af-bf94-02d07d57457f",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "17794e0c-af50-469f-93cc-b7a7d6f0b04f",
   "source_node_id": "07cc5008-e535-4871-8c6b-6a9e0bad1608",
   "target_node_id": "595120ec-815a-432e-93d3-b747575ec5d3",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "b013ec06-1d35-49c5-ad94-21c5ca5910cc",
   "source_node_id": "94109979-e70d-401b-9d14-05eb9c26fcec",
   "target_node_id": "595120ec-815a-432e-93d3-b747575ec5d3",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "92d16b44-19cc-4909-99d7-e0952645c34c",
   "source_node_id": "c554bfc5-ee7b-4d17-9ca7-a67e7ee22cb5",
   "target_node_id": "d7807681-8856-4974-afd1-309b761dbdd1",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "7fb28f90-dcbd-4603-b02b-d3ad90df5eb7",
   "source_node_id": "d7807681-8856-4974-afd1-309b761dbdd1",
   "target_node_id": "a402ede0-a5ec-4334-9f09-c66a74d93530",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "9a53d97c-fab5-4563-8396-8750ceec36f1",
   "source_node_id": "a402ede0-a5ec-4334-9f09-c66a74d93530",
   "target_node_id": "abc9dac9-76fb-4b68-b71e-3e9fefd87d16",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "c6eac60a-48f0-4fb5-b91e-261665f9e3cc",
   "source_node_id": "abc9dac9-76fb-4b68-b71e-3e9fefd87d16",
   "target_node_id": "1c738dd7-49e4-43df-bc98-b69e1953672e",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "21f48d61-aac7-49f7-bf00-a5e0d51f987e",
   "source_node_id": "a402ede0-a5ec-4334-9f09-c66a74d93530",
   "target_node_id": "737373a4-e2bd-4029-a047-12e773ca4c27",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "66783aef-87b4-4385-a6d6-32a15d743489",
   "source_node_id": "737373a4-e2bd-4029-a047-12e773ca4c27",
   "target_node_id": "116ee060-2637-42c3-822c-261f2e47680a",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "ebe81b62-643d-493e-808b-2cc20f2c22ff",
   "source_node_id": "abc9dac9-76fb-4b68-b71e-3e9fefd87d16",
   "target_node_id": "a4a41a3b-b8ff-43e7-a5fb-a628caa31ea5",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "0e4c631f-c509-46b9-a123-ed0b1f84ea4d",
   "source_node_id": "116ee060-2637-42c3-822c-261f2e47680a",
   "target_node_id": "732ca740-748d-4071-9d67-866157566c10",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "fb67f605-d697-474e-a011-a819464247a5",
   "source_node_id": "f0a93088-309f-4d7e-aa0b-01cb2086c6c2",
   "target_node_id": "3922cc55-5abd-4f19-80c3-81de97e4de30",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "e9f4ac8b-0d8a-4175-8a62-4b7d282d7893",
   "source_node_id": "a402ede0-a5ec-4334-9f09-c66a74d93530",
   "target_node_id": "3922cc55-5abd-4f19-80c3-81de97e4de30",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "2463416d-97be-48ff-bda2-6c14e3e06564",
   "source_node_id": "3922cc55-5abd-4f19-80c3-81de97e4de30",
   "target_node_id": "9aa64c18-206a-4854-8cde-b2a4079dcd5c",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "a5e06ab0-09e1-47e5-ab66-55f9ef546b82",
   "source_node_id": "3922cc55-5abd-4f19-80c3-81de97e4de30",
   "target_node_id": "83a0e6a6-1716-4587-8d43-d4b829b2f60c",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "cfafea84-148f-4c39-a2d5-63b93c870afe",
   "source_node_id": "732ca740-748d-4071-9d67-866157566c10",
   "target_node_id": "2c8554fa-237a-4553-93d9-63fc7ca734d8",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "db9ca366-43a3-4260-aa33-57282af60605",
   "source_node_id": "3922cc55-5abd-4f19-80c3-81de97e4de30",
   "target_node_id": "13aa3a29-9022-44f5-8083-003dbee785fc",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "b7114a3a-8f0f-4b9b-a557-6f2b559ec712",
   "source_node_id": "9aa64c18-206a-4854-8cde-b2a4079dcd5c",
   "target_node_id": "13aa3a29-9022-44f5-8083-003dbee785fc",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "787f63d1-47d9-4047-a3e7-cfa39b9c0b71",
   "source_node_id": "83a0e6a6-1716-4587-8d43-d4b829b2f60c",
   "target_node_id": "13aa3a29-9022-44f5-8083-003dbee785fc",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "66abdd4a-0cfd-482b-9c52-233b55b96a4c",
   "source_node_id": "2c8554fa-237a-4553-93d9-63fc7ca734d8",
   "target_node_id": "13aa3a29-9022-44f5-8083-003dbee785fc",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "eea4f193-cf62-4818-a7ce-b7fe236c5cf6",
   "source_node_id": "9ac22267-cfef-44de-80b9-dbacfbdb5bb9",
   "target_node_id": "13aa3a29-9022-44f5-8083-003dbee785fc",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "9880c213-608f-4c82-9b50-9c43886e3053",
   "source_node_id": "13aa3a29-9022-44f5-8083-003dbee785fc",
   "target_node_id": "b93cfacd-c356-42fb-b034-76583233b5e7",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "1ef8446c-7661-4eaf-9226-99526defe9ae",
   "source_node_id": "6ee00efb-e9fb-4f53-9ccb-1969898d8b0d",
   "target_node_id": "739ec377-299e-4490-ab09-9870f2500e95",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "5fd688da-b2ba-42c7-a7b0-046c7de3bd7d",
   "source_node_id": "739ec377-299e-4490-ab09-9870f2500e95",
   "target_node_id": "f9c8a315-ef63-4894-a2a6-995651fe4ce1",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "a7d63543-9b8a-4365-ae62-70ce3c61284c",
   "source_node_id": "f9c8a315-ef63-4894-a2a6-995651fe4ce1",
   "target_node_id": "9344203d-b978-40d9-b800-f8905dfb2481",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "14521bfd-3f1c-4777-a59c-12eed9bde3de",
   "source_node_id": "739ec377-299e-4490-ab09-9870f2500e95",
   "target_node_id": "d6711889-c821-4f05-80d4-7e707e0c87d1",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "c9078259-bb4d-4b9a-b4d0-99a1a5b205df",
   "source_node_id": "f9c8a315-ef63-4894-a2a6-995651fe4ce1",
   "target_node_id": "23156b14-848f-4c20-8adc-49f9e5946485",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "fdff7636-d27b-4685-901e-089842743e73",
   "source_node_id": "d6711889-c821-4f05-80d4-7e707e0c87d1",
   "target_node_id": "0e7af60a-3595-4c1f-8c03-c7f7e116e36f",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "b7b3720a-5fda-46ce-ad51-50e67573c411",
   "source_node_id": "0e7af60a-3595-4c1f-8c03-c7f7e116e36f",
   "target_node_id": "23156b14-848f-4c20-8adc-49f9e5946485",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "aa6040e6-2737-4e73-a046-6d8e8ab1cbff",
   "source_node_id": "23156b14-848f-4c20-8adc-49f9e5946485",
   "target_node_id": "3ff7f0cc-69f8-4ee2-9aa0-6e7b683bef15",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "e52e03e2-087c-41e1-828f-a08af5314ab3",
   "source_node_id": "d6711889-c821-4f05-80d4-7e707e0c87d1",
   "target_node_id": "48755817-a6f5-4028-b520-bfebc91b3a7e",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "85c89626-dbb9-4b53-a751-ca1c3e2f1ded",
   "source_node_id": "3ff7f0cc-69f8-4ee2-9aa0-6e7b683bef15",
   "target_node_id": "128edac4-11c7-4915-96d3-4c5a0199b85f",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "99843ec7-9c26-4514-abb3-2ba7351135fc",
   "source_node_id": "128edac4-11c7-4915-96d3-4c5a0199b85f",
   "target_node_id": "4969f6bd-144f-4bf1-a1c3-afc4fa7bc11b",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "afc6555f-14fc-47a7-894d-5042baaddbb2",
   "source_node_id": "3752d1ad-a924-4be5-9b73-ec69b9cd0075",
   "target_node_id": "4969f6bd-144f-4bf1-a1c3-afc4fa7bc11b",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "e8b6ecb5-307d-4ef8-bdb4-e508863dd24e",
   "source_node_id": "23156b14-848f-4c20-8adc-49f9e5946485",
   "target_node_id": "483d039e-7a01-44eb-b2de-a1f81a2cda56",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "34510984-112f-49d2-b44c-81cc19823c1b",
   "source_node_id": "483d039e-7a01-44eb-b2de-a1f81a2cda56",
   "target_node_id": "dfbe334a-07d2-4ffe-a935-acd06a32d63f",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "1012bd55-c577-4bc7-aaf6-1cb1cf0ff732",
   "source_node_id": "3ff7f0cc-69f8-4ee2-9aa0-6e7b683bef15",
   "target_node_id": "51b7bcbb-d95b-454b-8af8-89996287a486",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "cfebc2e8-4b43-4362-a88a-7a06f5d67955",
   "source_node_id": "483d039e-7a01-44eb-b2de-a1f81a2cda56",
   "target_node_id": "51b7bcbb-d95b-454b-8af8-89996287a486",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "e19e15e4-c3d2-4caf-8f0c-2d4a7164359a",
   "source_node_id": "dfbe334a-07d2-4ffe-a935-acd06a32d63f",
   "target_node_id": "51b7bcbb-d95b-454b-8af8-89996287a486",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "d69c8cc0-bcf3-49d1-9f43-6db3c24db971",
   "source_node_id": "483d039e-7a01-44eb-b2de-a1f81a2cda56",
   "target_node_id": "6e719622-0e6b-4692-9cea-46b2af689c40",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "50c7cf18-fa26-44c2-9656-7edd8afeed4f",
   "source_node_id": "51b7bcbb-d95b-454b-8af8-89996287a486",
   "target_node_id": "6e719622-0e6b-4692-9cea-46b2af689c40",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "16346f84-e91f-4d83-bfdb-e55418ddd757",
   "source_node_id": "6e719622-0e6b-4692-9cea-46b2af689c40",
   "target_node_id": "66933d23-e251-427c-8fc0-51440664bca5",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "1878a516-ef11-49c6-ab45-da597ac922c3",
   "source_node_id": "66933d23-e251-427c-8fc0-51440664bca5",
   "target_node_id": "9f159526-96cb-41cf-9b05-788ec5566d7c",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "348663ca-6e29-4a86-856c-e6240d325d56",
   "source_node_id": "9f159526-96cb-41cf-9b05-788ec5566d7c",
   "target_node_id": "739ba659-c247-4621-90db-4ca33d0575a4",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "954574b7-ee67-4370-bd7c-8db3f8c4e27e",
   "source_node_id": "fc50e141-603a-4910-a912-f0acc063c5c3",
   "target_node_id": "c8266c32-dea2-4694-8db9-22407d3a754c",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "480c067d-c9a7-473a-a538-7e09e41ad0f7",
   "source_node_id": "739ba659-c247-4621-90db-4ca33d0575a4",
   "target_node_id": "c8266c32-dea2-4694-8db9-22407d3a754c",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "0e3fc028-9b64-4779-bdfa-4d9f6382f9e0",
   "source_node_id": "198c0871-3f90-445f-98e7-a3c74145204f",
   "target_node_id": "1b6c5cc0-ed37-40c2-8f55-9af2f2f0c86e",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "db79b006-99e3-44ed-b8a2-a066f07f5b0d",
   "source_node_id": "1b6c5cc0-ed37-40c2-8f55-9af2f2f0c86e",
   "target_node_id": "fd48fbae-c508-43b9-a7b0-6409a8fbae2b",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "eef03f36-55af-4bbf-8193-da1e62896289",
   "source_node_id": "6e719622-0e6b-4692-9cea-46b2af689c40",
   "target_node_id": "fd48fbae-c508-43b9-a7b0-6409a8fbae2b",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "19e7e9ce-be35-4405-a71c-88c9d3282df8",
   "source_node_id": "c8266c32-dea2-4694-8db9-22407d3a754c",
   "target_node_id": "fd48fbae-c508-43b9-a7b0-6409a8fbae2b",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "d076af08-b55d-491b-b9e0-e1fc2700f1ca",
   "source_node_id": "51b7bcbb-d95b-454b-8af8-89996287a486",
   "target_node_id": "fd48fbae-c508-43b9-a7b0-6409a8fbae2b",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "71cc861e-9973-4680-a81c-158d3e5f009e",
   "source_node_id": "b93cfacd-c356-42fb-b034-76583233b5e7",
   "target_node_id": "fd48fbae-c508-43b9-a7b0-6409a8fbae2b",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "c2a38b56-bd5b-45eb-8439-e1b67b46b075",
   "source_node_id": "fd48fbae-c508-43b9-a7b0-6409a8fbae2b",
   "target_node_id": "b3e45f22-457f-4d18-9e9c-fa5490c75d22",
   "edge_type": "prerequisite",
   "label": "前置知识"
  }
 ],
 "progress": [
  {
   "node_id": "d2e470c6-53fa-42d4-a76b-5e8e2bbeafdc",
   "status": "mastered",
   "evidence": ""
  },
  {
   "node_id": "9342764f-dc9a-4dc1-a67a-d1aea8d506bf",
   "status": "mastered",
   "evidence": ""
  },
  {
   "node_id": "5601a744-824e-438e-b5c1-d7cb71738109",
   "status": "completed",
   "evidence": ""
  },
  {
   "node_id": "a0e1efda-207f-4d71-aa0d-880ba9459d9c",
   "status": "completed",
   "evidence": ""
  },
  {
   "node_id": "7c19a329-ef4f-4184-8e68-25dc39d9cd36",
   "status": "completed",
   "evidence": ""
  },
  {
   "node_id": "60428e17-cbea-47f8-abe7-ad9836d507dc",
   "status": "completed",
   "evidence": ""
  },
  {
   "node_id": "20d55018-d087-4139-9b61-bd9f448b3e71",
   "status": "completed",
   "evidence": ""
  },
  {
   "node_id": "af2e6854-6767-4fe8-9ace-e65e801d91b8",
   "status": "completed",
   "evidence": ""
  },
  {
   "node_id": "0288aab3-c9d4-4892-8df7-8ea3146fc589",
   "status": "completed",
   "evidence": ""
  },
  {
   "node_id": "cca38f80-b13e-4cf3-abcd-42a62972e65e",
   "status": "completed",
   "evidence": ""
  },
  {
   "node_id": "b77d7727-7c28-4600-b3fb-3b2be509caf2",
   "status": "completed",
   "evidence": ""
  },
  {
   "node_id": "3d6c07f7-db74-4e2a-9ed2-6c3e3f274971",
   "status": "completed",
   "evidence": ""
  },
  {
   "node_id": "c351e62a-2075-4257-8fc0-40c69cf732d5",
   "status": "completed",
   "evidence": ""
  },
  {
   "node_id": "08011079-802d-4d84-b916-fad4326c8d21",
   "status": "completed",
   "evidence": ""
  },
  {
   "node_id": "6ee00efb-e9fb-4f53-9ccb-1969898d8b0d",
   "status": "completed",
   "evidence": ""
  },
  {
   "node_id": "4d9bfb2b-45a2-4665-8bec-698482d1d279",
   "status": "completed",
   "evidence": ""
  },
  {
   "node_id": "90a111bf-94dd-461d-84bf-28202ee189d3",
   "status": "completed",
   "evidence": ""
  },
  {
   "node_id": "b62cbb4f-735d-43c4-8735-dd1b5aebf371",
   "status": "completed",
   "evidence": ""
  },
  {
   "node_id": "3f1f3348-a59e-4511-9111-7c09bdaf622f",
   "status": "completed",
   "evidence": ""
  },
  {
   "node_id": "44c17298-ff37-4f87-8ecc-40d02da79202",
   "status": "completed",
   "evidence": ""
  },
  {
   "node_id": "0bc47c29-37d7-4108-977e-3bbbc27871d1",
   "status": "in_progress",
   "evidence": ""
  },
  {
   "node_id": "198c0871-3f90-445f-98e7-a3c74145204f",
   "status": "completed",
   "evidence": ""
  },
  {
   "node_id": "3752d1ad-a924-4be5-9b73-ec69b9cd0075",
   "status": "not_started",
   "evidence": ""
  },
  {
   "node_id": "d5737471-c58a-420a-8783-749a3c20b01d",
   "status": "completed",
   "evidence": ""
  },
  {
   "node_id": "f0a93088-309f-4d7e-aa0b-01cb2086c6c2",
   "status": "not_started",
   "evidence": ""
  },
  {
   "node_id": "1bcf6b77-3954-46ab-8d50-de7ef2516cb1",
   "status": "not_started",
   "evidence": ""
  },
  {
   "node_id": "fc50e141-603a-4910-a912-f0acc063c5c3",
   "status": "not_started",
   "evidence": ""
  },
  {
   "node_id": "66fe0ed1-472a-4972-9e99-5d2121a7675f",
   "status": "not_started",
   "evidence": ""
  },
  {
   "node_id": "9ac22267-cfef-44de-80b9-dbacfbdb5bb9",
   "status": "not_started",
   "evidence": ""
  },
  {
   "node_id": "ab46b258-1695-430c-86fc-9c9880b9ff85",
   "status": "not_started",
   "evidence": ""
  },
  {
   "node_id": "c554bfc5-ee7b-4d17-9ca7-a67e7ee22cb5",
   "status": "not_started",
   "evidence": ""
  },
  {
   "node_id": "85f20b67-3dc7-4fb0-95b7-5432881e919c",
   "status": "not_started",
   "evidence": ""
  },
  {
   "node_id": "bbd918de-245b-4835-a5fd-763ec7fb8692",
   "status": "not_started",
   "evidence": ""
  },
  {
   "node_id": "8925f021-1a1c-4baf-8d5d-1f90435f9f81",
   "status": "not_started",
   "evidence": ""
  },
  {
   "node_id": "8df58799-9428-4663-a1e7-b171b6c8991d",
   "status": "not_started",
   "evidence": ""
  },
  {
   "node_id": "07cc5008-e535-4871-8c6b-6a9e0bad1608",
   "status": "not_started",
   "evidence": ""
  },
  {
   "node_id": "94109979-e70d-401b-9d14-05eb9c26fcec",
   "status": "not_started",
   "evidence": ""
  },
  {
   "node_id": "a74d8a3d-39ce-45af-bf94-02d07d57457f",
   "status": "not_started",
   "evidence": ""
  },
  {
   "node_id": "595120ec-815a-432e-93d3-b747575ec5d3",
   "status": "not_started",
   "evidence": ""
  },
  {
   "node_id": "d7807681-8856-4974-afd1-309b761dbdd1",
   "status": "not_started",
   "evidence": ""
  },
  {
   "node_id": "a402ede0-a5ec-4334-9f09-c66a74d93530",
   "status": "not_started",
   "evidence": ""
  },
  {
   "node_id": "abc9dac9-76fb-4b68-b71e-3e9fefd87d16",
   "status": "not_started",
   "evidence": ""
  },
  {
   "node_id": "1c738dd7-49e4-43df-bc98-b69e1953672e",
   "status": "not_started",
   "evidence": ""
  },
  {
   "node_id": "737373a4-e2bd-4029-a047-12e773ca4c27",
   "status": "not_started",
   "evidence": ""
  },
  {
   "node_id": "116ee060-2637-42c3-822c-261f2e47680a",
   "status": "not_started",
   "evidence": ""
  },
  {
   "node_id": "a4a41a3b-b8ff-43e7-a5fb-a628caa31ea5",
   "status": "not_started",
   "evidence": ""
  },
  {
   "node_id": "732ca740-748d-4071-9d67-866157566c10",
   "status": "not_started",
   "evidence": ""
  },
  {
   "node_id": "3922cc55-5abd-4f19-80c3-81de97e4de30",
   "status": "not_started",
   "evidence": ""
  },
  {
   "node_id": "9aa64c18-206a-4854-8cde-b2a4079dcd5c",
   "status": "not_started",
   "evidence": ""
  },
  {
   "node_id": "83a0e6a6-1716-4587-8d43-d4b829b2f60c",
   "status": "not_started",
   "evidence": ""
  },
  {
   "node_id": "2c8554fa-237a-4553-93d9-63fc7ca734d8",
   "status": "not_started",
   "evidence": ""
  },
  {
   "node_id": "13aa3a29-9022-44f5-8083-003dbee785fc",
   "status": "not_started",
   "evidence": ""
  },
  {
   "node_id": "b93cfacd-c356-42fb-b034-76583233b5e7",
   "status": "not_started",
   "evidence": ""
  },
  {
   "node_id": "739ec377-299e-4490-ab09-9870f2500e95",
   "status": "not_started",
   "evidence": ""
  },
  {
   "node_id": "f9c8a315-ef63-4894-a2a6-995651fe4ce1",
   "status": "not_started",
   "evidence": ""
  },
  {
   "node_id": "9344203d-b978-40d9-b800-f8905dfb2481",
   "status": "not_started",
   "evidence": ""
  },
  {
   "node_id": "d6711889-c821-4f05-80d4-7e707e0c87d1",
   "status": "not_started",
   "evidence": ""
  },
  {
   "node_id": "0e7af60a-3595-4c1f-8c03-c7f7e116e36f",
   "status": "not_started",
   "evidence": ""
  },
  {
   "node_id": "23156b14-848f-4c20-8adc-49f9e5946485",
   "status": "not_started",
   "evidence": ""
  },
  {
   "node_id": "3ff7f0cc-69f8-4ee2-9aa0-6e7b683bef15",
   "status": "not_started",
   "evidence": ""
  },
  {
   "node_id": "48755817-a6f5-4028-b520-bfebc91b3a7e",
   "status": "not_started",
   "evidence": ""
  },
  {
   "node_id": "128edac4-11c7-4915-96d3-4c5a0199b85f",
   "status": "not_started",
   "evidence": ""
  },
  {
   "node_id": "4969f6bd-144f-4bf1-a1c3-afc4fa7bc11b",
   "status": "not_started",
   "evidence": ""
  },
  {
   "node_id": "483d039e-7a01-44eb-b2de-a1f81a2cda56",
   "status": "not_started",
   "evidence": ""
  },
  {
   "node_id": "dfbe334a-07d2-4ffe-a935-acd06a32d63f",
   "status": "not_started",
   "evidence": ""
  },
  {
   "node_id": "51b7bcbb-d95b-454b-8af8-89996287a486",
   "status": "not_started",
   "evidence": ""
  },
  {
   "node_id": "6e719622-0e6b-4692-9cea-46b2af689c40",
   "status": "not_started",
   "evidence": ""
  },
  {
   "node_id": "66933d23-e251-427c-8fc0-51440664bca5",
   "status": "not_started",
   "evidence": ""
  },
  {
   "node_id": "9f159526-96cb-41cf-9b05-788ec5566d7c",
   "status": "not_started",
   "evidence": ""
  },
  {
   "node_id": "739ba659-c247-4621-90db-4ca33d0575a4",
   "status": "not_started",
   "evidence": ""
  },
  {
   "node_id": "1b6c5cc0-ed37-40c2-8f55-9af2f2f0c86e",
   "status": "not_started",
   "evidence": ""
  },
  {
   "node_id": "c8266c32-dea2-4694-8db9-22407d3a754c",
   "status": "not_started",
   "evidence": ""
  },
  {
   "node_id": "fd48fbae-c508-43b9-a7b0-6409a8fbae2b",
   "status": "not_started",
   "evidence": ""
  },
  {
   "node_id": "b3e45f22-457f-4d18-9e9c-fa5490c75d22",
   "status": "not_started",
   "evidence": ""
  }
 ]
};
