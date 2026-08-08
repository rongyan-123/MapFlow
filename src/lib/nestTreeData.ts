import type { LearningTreeSnapshot } from '../types/learning';

export const NEST_TREE: LearningTreeSnapshot = {
 "tree": {
  "id": "005d217e-2106-4a8f-ab84-769d48f52c08",
  "topic": "NestJS + Agent AI Backend",
  "title": "生产级 Agent AI 应用后端完整体系（NestJS）",
  "description": "完整 NestJS 知识树 + 生产级 AI/Agent 应用能力图。",
  "difficulty_level": "advanced",
  "total_nodes": 79
 },
 "current_node_id": "b3d38af8-4dbf-4d07-a3bc-96b5992895c0",
 "nodes": [
  {
   "id": "733f0ac2-5a0d-409a-aaf6-980c6180448c",
   "tree_id": "005d217e-2106-4a8f-ab84-769d48f52c08",
   "title": "后端请求链路与 Node 运行时",
   "description": "学习 后端请求链路与 Node 运行时，建立可测试、可维护、可部署的 NestJS 后端能力。",
   "icon": "compass",
   "category": "框架核心",
   "difficulty": 2,
   "estimated_minutes": 90,
   "depth_level": 1,
   "position_x": 896.0,
   "position_y": 116.0,
   "order_in_level": 0,
   "learning_objectives": "[\"能够用自己的话解释“后端请求链路与 Node 运行时”解决的问题与适用边界\", \"能够在 NestJS 后端中实现并验证“后端请求链路与 Node 运行时”的最小闭环\"]",
   "key_concepts": "[\"后端请求链路与 Node 运行时\", \"NestJS\", \"生产级后端\"]",
   "recommended_depth": "Understand",
   "depth_rationale": "该节点会影响架构边界或故障判断；不能只会调 API，还要能解释核心机制、边界与典型错误。",
   "observable_evidence": "[\"能够用自己的话解释“后端请求链路与 Node 运行时”解决的问题与适用边界\", \"能够在 NestJS 后端中实现并验证“后端请求链路与 Node 运行时”的最小闭环\", \"能画出或口述「后端请求链路与 Node 运行时」的关键机制，解释边界并诊断一个典型错误\"]"
  },
  {
   "id": "a489a8a5-60b0-421d-b961-d2c333c89d48",
   "tree_id": "005d217e-2106-4a8f-ab84-769d48f52c08",
   "title": "Nest 应用启动与平台适配器",
   "description": "学习 Nest 应用启动与平台适配器，建立可测试、可维护、可部署的 NestJS 后端能力。",
   "icon": "compass",
   "category": "框架核心",
   "difficulty": 2,
   "estimated_minutes": 90,
   "depth_level": 2,
   "position_x": 1008.0,
   "position_y": 232.0,
   "order_in_level": 0,
   "learning_objectives": "[\"能够用自己的话解释“Nest 应用启动与平台适配器”解决的问题与适用边界\", \"能够在 NestJS 后端中实现并验证“Nest 应用启动与平台适配器”的最小闭环\"]",
   "key_concepts": "[\"Nest 应用启动与平台适配器\", \"NestJS\", \"生产级后端\"]",
   "recommended_depth": "Use",
   "depth_rationale": "该节点是可重复使用的工程能力；学习终点是脱离逐行照抄后仍能按可靠模式完成实现。",
   "observable_evidence": "[\"能够用自己的话解释“Nest 应用启动与平台适配器”解决的问题与适用边界\", \"能够在 NestJS 后端中实现并验证“Nest 应用启动与平台适配器”的最小闭环\", \"能独立完成「Nest 应用启动与平台适配器」的最小可运行实现，并用测试、请求或日志证明其行为\"]"
  },
  {
   "id": "553f1af2-7c28-43e3-9fe5-c1b2b5af93b7",
   "tree_id": "005d217e-2106-4a8f-ab84-769d48f52c08",
   "title": "PostgreSQL 与关系建模",
   "description": "学习 PostgreSQL 与关系建模，建立可测试、可维护、可部署的 NestJS 后端能力。",
   "icon": "shield",
   "category": "数据一致性",
   "difficulty": 2,
   "estimated_minutes": 90,
   "depth_level": 2,
   "position_x": 784.0,
   "position_y": 232.0,
   "order_in_level": 1,
   "learning_objectives": "[\"能够用自己的话解释“PostgreSQL 与关系建模”解决的问题与适用边界\", \"能够在 NestJS 后端中实现并验证“PostgreSQL 与关系建模”的最小闭环\"]",
   "key_concepts": "[\"PostgreSQL 与关系建模\", \"NestJS\", \"生产级后端\"]",
   "recommended_depth": "Understand",
   "depth_rationale": "该节点会影响架构边界或故障判断；不能只会调 API，还要能解释核心机制、边界与典型错误。",
   "observable_evidence": "[\"能够用自己的话解释“PostgreSQL 与关系建模”解决的问题与适用边界\", \"能够在 NestJS 后端中实现并验证“PostgreSQL 与关系建模”的最小闭环\", \"能画出或口述「PostgreSQL 与关系建模」的关键机制，解释边界并诊断一个典型错误\"]"
  },
  {
   "id": "fc501705-d7b5-4a72-bbd6-a17d31862450",
   "tree_id": "005d217e-2106-4a8f-ab84-769d48f52c08",
   "title": "装饰器、元数据与反射",
   "description": "学习 装饰器、元数据与反射，建立可测试、可维护、可部署的 NestJS 后端能力。",
   "icon": "compass",
   "category": "框架核心",
   "difficulty": 2,
   "estimated_minutes": 90,
   "depth_level": 3,
   "position_x": 896.0,
   "position_y": 348.0,
   "order_in_level": 0,
   "learning_objectives": "[\"能够用自己的话解释“装饰器、元数据与反射”解决的问题与适用边界\", \"能够在 NestJS 后端中实现并验证“装饰器、元数据与反射”的最小闭环\"]",
   "key_concepts": "[\"装饰器、元数据与反射\", \"NestJS\", \"生产级后端\"]",
   "recommended_depth": "Understand",
   "depth_rationale": "该节点会影响架构边界或故障判断；不能只会调 API，还要能解释核心机制、边界与典型错误。",
   "observable_evidence": "[\"能够用自己的话解释“装饰器、元数据与反射”解决的问题与适用边界\", \"能够在 NestJS 后端中实现并验证“装饰器、元数据与反射”的最小闭环\", \"能画出或口述「装饰器、元数据与反射」的关键机制，解释边界并诊断一个典型错误\"]"
  },
  {
   "id": "7305a41d-1a7f-4cbe-aab0-db66e48f7a73",
   "tree_id": "005d217e-2106-4a8f-ab84-769d48f52c08",
   "title": "模块与依赖图",
   "description": "学习 模块与依赖图，建立可测试、可维护、可部署的 NestJS 后端能力。",
   "icon": "compass",
   "category": "框架核心",
   "difficulty": 2,
   "estimated_minutes": 90,
   "depth_level": 4,
   "position_x": 896.0,
   "position_y": 464.0,
   "order_in_level": 0,
   "learning_objectives": "[\"能够用自己的话解释“模块与依赖图”解决的问题与适用边界\", \"能够在 NestJS 后端中实现并验证“模块与依赖图”的最小闭环\"]",
   "key_concepts": "[\"模块与依赖图\", \"NestJS\", \"生产级后端\"]",
   "recommended_depth": "Understand",
   "depth_rationale": "该节点会影响架构边界或故障判断；不能只会调 API，还要能解释核心机制、边界与典型错误。",
   "observable_evidence": "[\"能够用自己的话解释“模块与依赖图”解决的问题与适用边界\", \"能够在 NestJS 后端中实现并验证“模块与依赖图”的最小闭环\", \"能画出或口述「模块与依赖图」的关键机制，解释边界并诊断一个典型错误\"]"
  },
  {
   "id": "b8c696d2-eb90-4462-a67c-46cb5e9271fd",
   "tree_id": "005d217e-2106-4a8f-ab84-769d48f52c08",
   "title": "Provider 与依赖注入",
   "description": "学习 Provider 与依赖注入，建立可测试、可维护、可部署的 NestJS 后端能力。",
   "icon": "compass",
   "category": "框架核心",
   "difficulty": 3,
   "estimated_minutes": 90,
   "depth_level": 5,
   "position_x": 896.0,
   "position_y": 580.0,
   "order_in_level": 0,
   "learning_objectives": "[\"能够用自己的话解释“Provider 与依赖注入”解决的问题与适用边界\", \"能够在 NestJS 后端中实现并验证“Provider 与依赖注入”的最小闭环\"]",
   "key_concepts": "[\"Provider 与依赖注入\", \"NestJS\", \"生产级后端\"]",
   "recommended_depth": "Understand",
   "depth_rationale": "该节点会影响架构边界或故障判断；不能只会调 API，还要能解释核心机制、边界与典型错误。",
   "observable_evidence": "[\"能够用自己的话解释“Provider 与依赖注入”解决的问题与适用边界\", \"能够在 NestJS 后端中实现并验证“Provider 与依赖注入”的最小闭环\", \"能画出或口述「Provider 与依赖注入」的关键机制，解释边界并诊断一个典型错误\"]"
  },
  {
   "id": "bd92e618-db3f-486d-8668-cdca815c0af3",
   "tree_id": "005d217e-2106-4a8f-ab84-769d48f52c08",
   "title": "Controller 与路由",
   "description": "学习 Controller 与路由，建立可测试、可维护、可部署的 NestJS 后端能力。",
   "icon": "compass",
   "category": "框架核心",
   "difficulty": 3,
   "estimated_minutes": 90,
   "depth_level": 6,
   "position_x": 784.0,
   "position_y": 696.0,
   "order_in_level": 0,
   "learning_objectives": "[\"能够用自己的话解释“Controller 与路由”解决的问题与适用边界\", \"能够在 NestJS 后端中实现并验证“Controller 与路由”的最小闭环\"]",
   "key_concepts": "[\"Controller 与路由\", \"NestJS\", \"生产级后端\"]",
   "recommended_depth": "Use",
   "depth_rationale": "该节点是可重复使用的工程能力；学习终点是脱离逐行照抄后仍能按可靠模式完成实现。",
   "observable_evidence": "[\"能够用自己的话解释“Controller 与路由”解决的问题与适用边界\", \"能够在 NestJS 后端中实现并验证“Controller 与路由”的最小闭环\", \"能独立完成「Controller 与路由」的最小可运行实现，并用测试、请求或日志证明其行为\"]"
  },
  {
   "id": "b9af692b-da07-40e5-a7fd-ab13d5af4838",
   "tree_id": "005d217e-2106-4a8f-ab84-769d48f52c08",
   "title": "配置、环境与秘密",
   "description": "学习 配置、环境与秘密，建立可测试、可维护、可部署的 NestJS 后端能力。",
   "icon": "code",
   "category": "API边界",
   "difficulty": 3,
   "estimated_minutes": 90,
   "depth_level": 6,
   "position_x": 1008.0,
   "position_y": 696.0,
   "order_in_level": 1,
   "learning_objectives": "[\"能够用自己的话解释“配置、环境与秘密”解决的问题与适用边界\", \"能够在 NestJS 后端中实现并验证“配置、环境与秘密”的最小闭环\"]",
   "key_concepts": "[\"配置、环境与秘密\", \"NestJS\", \"生产级后端\"]",
   "recommended_depth": "Use",
   "depth_rationale": "该节点是可重复使用的工程能力；学习终点是脱离逐行照抄后仍能按可靠模式完成实现。",
   "observable_evidence": "[\"能够用自己的话解释“配置、环境与秘密”解决的问题与适用边界\", \"能够在 NestJS 后端中实现并验证“配置、环境与秘密”的最小闭环\", \"能独立完成「配置、环境与秘密」的最小可运行实现，并用测试、请求或日志证明其行为\"]"
  },
  {
   "id": "d3f2ac22-57b5-4643-a647-9f1a5f0a36ba",
   "tree_id": "005d217e-2106-4a8f-ab84-769d48f52c08",
   "title": "Service 与业务边界",
   "description": "学习 Service 与业务边界，建立可测试、可维护、可部署的 NestJS 后端能力。",
   "icon": "compass",
   "category": "框架核心",
   "difficulty": 3,
   "estimated_minutes": 90,
   "depth_level": 7,
   "position_x": 896.0,
   "position_y": 812.0,
   "order_in_level": 0,
   "learning_objectives": "[\"能够用自己的话解释“Service 与业务边界”解决的问题与适用边界\", \"能够在 NestJS 后端中实现并验证“Service 与业务边界”的最小闭环\"]",
   "key_concepts": "[\"Service 与业务边界\", \"NestJS\", \"生产级后端\"]",
   "recommended_depth": "Understand",
   "depth_rationale": "该节点会影响架构边界或故障判断；不能只会调 API，还要能解释核心机制、边界与典型错误。",
   "observable_evidence": "[\"能够用自己的话解释“Service 与业务边界”解决的问题与适用边界\", \"能够在 NestJS 后端中实现并验证“Service 与业务边界”的最小闭环\", \"能画出或口述「Service 与业务边界」的关键机制，解释边界并诊断一个典型错误\"]"
  },
  {
   "id": "2a639942-cba2-4931-b3a1-d6e5734621a2",
   "tree_id": "005d217e-2106-4a8f-ab84-769d48f52c08",
   "title": "请求生命周期全景",
   "description": "学习 请求生命周期全景，建立可测试、可维护、可部署的 NestJS 后端能力。",
   "icon": "compass",
   "category": "框架核心",
   "difficulty": 3,
   "estimated_minutes": 90,
   "depth_level": 8,
   "position_x": 1008.0,
   "position_y": 928.0,
   "order_in_level": 0,
   "learning_objectives": "[\"能够用自己的话解释“请求生命周期全景”解决的问题与适用边界\", \"能够在 NestJS 后端中实现并验证“请求生命周期全景”的最小闭环\"]",
   "key_concepts": "[\"请求生命周期全景\", \"NestJS\", \"生产级后端\"]",
   "recommended_depth": "Understand",
   "depth_rationale": "该节点会影响架构边界或故障判断；不能只会调 API，还要能解释核心机制、边界与典型错误。",
   "observable_evidence": "[\"能够用自己的话解释“请求生命周期全景”解决的问题与适用边界\", \"能够在 NestJS 后端中实现并验证“请求生命周期全景”的最小闭环\", \"能画出或口述「请求生命周期全景」的关键机制，解释边界并诊断一个典型错误\"]"
  },
  {
   "id": "9f3c356a-05a8-4bdf-90e4-d260721451cf",
   "tree_id": "005d217e-2106-4a8f-ab84-769d48f52c08",
   "title": "ORM 集成与 Repository 边界",
   "description": "学习 ORM 集成与 Repository 边界，建立可测试、可维护、可部署的 NestJS 后端能力。",
   "icon": "shield",
   "category": "数据一致性",
   "difficulty": 3,
   "estimated_minutes": 90,
   "depth_level": 8,
   "position_x": 784.0,
   "position_y": 928.0,
   "order_in_level": 1,
   "learning_objectives": "[\"能够用自己的话解释“ORM 集成与 Repository 边界”解决的问题与适用边界\", \"能够在 NestJS 后端中实现并验证“ORM 集成与 Repository 边界”的最小闭环\"]",
   "key_concepts": "[\"ORM 集成与 Repository 边界\", \"NestJS\", \"生产级后端\"]",
   "recommended_depth": "Use",
   "depth_rationale": "该节点是可重复使用的工程能力；学习终点是脱离逐行照抄后仍能按可靠模式完成实现。",
   "observable_evidence": "[\"能够用自己的话解释“ORM 集成与 Repository 边界”解决的问题与适用边界\", \"能够在 NestJS 后端中实现并验证“ORM 集成与 Repository 边界”的最小闭环\", \"能独立完成「ORM 集成与 Repository 边界」的最小可运行实现，并用测试、请求或日志证明其行为\"]"
  },
  {
   "id": "dd6fcc43-af99-44ac-b3c9-d389e101ff61",
   "tree_id": "005d217e-2106-4a8f-ab84-769d48f52c08",
   "title": "Middleware",
   "description": "学习 Middleware，建立可测试、可维护、可部署的 NestJS 后端能力。",
   "icon": "code",
   "category": "API边界",
   "difficulty": 4,
   "estimated_minutes": 90,
   "depth_level": 9,
   "position_x": 1120.0,
   "position_y": 1044.0,
   "order_in_level": 0,
   "learning_objectives": "[\"能够用自己的话解释“Middleware”解决的问题与适用边界\", \"能够在 NestJS 后端中实现并验证“Middleware”的最小闭环\"]",
   "key_concepts": "[\"Middleware\", \"NestJS\", \"生产级后端\"]",
   "recommended_depth": "Use",
   "depth_rationale": "该节点是可重复使用的工程能力；学习终点是脱离逐行照抄后仍能按可靠模式完成实现。",
   "observable_evidence": "[\"能够用自己的话解释“Middleware”解决的问题与适用边界\", \"能够在 NestJS 后端中实现并验证“Middleware”的最小闭环\", \"能独立完成「Middleware」的最小可运行实现，并用测试、请求或日志证明其行为\"]"
  },
  {
   "id": "c6e9be5e-ba1d-4d07-aeb1-92de85a1c58e",
   "tree_id": "005d217e-2106-4a8f-ab84-769d48f52c08",
   "title": "DTO、Pipe、验证与转换",
   "description": "学习 DTO、Pipe、验证与转换，建立可测试、可维护、可部署的 NestJS 后端能力。",
   "icon": "code",
   "category": "API边界",
   "difficulty": 4,
   "estimated_minutes": 90,
   "depth_level": 9,
   "position_x": 1344.0,
   "position_y": 1044.0,
   "order_in_level": 1,
   "learning_objectives": "[\"能够用自己的话解释“DTO、Pipe、验证与转换”解决的问题与适用边界\", \"能够在 NestJS 后端中实现并验证“DTO、Pipe、验证与转换”的最小闭环\"]",
   "key_concepts": "[\"DTO、Pipe、验证与转换\", \"NestJS\", \"生产级后端\"]",
   "recommended_depth": "Use",
   "depth_rationale": "该节点是可重复使用的工程能力；学习终点是脱离逐行照抄后仍能按可靠模式完成实现。",
   "observable_evidence": "[\"能够用自己的话解释“DTO、Pipe、验证与转换”解决的问题与适用边界\", \"能够在 NestJS 后端中实现并验证“DTO、Pipe、验证与转换”的最小闭环\", \"能独立完成「DTO、Pipe、验证与转换」的最小可运行实现，并用测试、请求或日志证明其行为\"]"
  },
  {
   "id": "bc4df4b4-7cdf-41dd-8d3e-656bd47df8b4",
   "tree_id": "005d217e-2106-4a8f-ab84-769d48f52c08",
   "title": "Guard 与访问决策",
   "description": "学习 Guard 与访问决策，建立可测试、可维护、可部署的 NestJS 后端能力。",
   "icon": "code",
   "category": "API边界",
   "difficulty": 4,
   "estimated_minutes": 90,
   "depth_level": 9,
   "position_x": 896.0,
   "position_y": 1044.0,
   "order_in_level": 2,
   "learning_objectives": "[\"能够用自己的话解释“Guard 与访问决策”解决的问题与适用边界\", \"能够在 NestJS 后端中实现并验证“Guard 与访问决策”的最小闭环\"]",
   "key_concepts": "[\"Guard 与访问决策\", \"NestJS\", \"生产级后端\"]",
   "recommended_depth": "Understand",
   "depth_rationale": "该节点会影响架构边界或故障判断；不能只会调 API，还要能解释核心机制、边界与典型错误。",
   "observable_evidence": "[\"能够用自己的话解释“Guard 与访问决策”解决的问题与适用边界\", \"能够在 NestJS 后端中实现并验证“Guard 与访问决策”的最小闭环\", \"能画出或口述「Guard 与访问决策」的关键机制，解释边界并诊断一个典型错误\"]"
  },
  {
   "id": "0194790d-0689-4665-a4fb-b882e33e5a87",
   "tree_id": "005d217e-2106-4a8f-ab84-769d48f52c08",
   "title": "Migration、Seed 与 Schema 演进",
   "description": "学习 Migration、Seed 与 Schema 演进，建立可测试、可维护、可部署的 NestJS 后端能力。",
   "icon": "shield",
   "category": "数据一致性",
   "difficulty": 4,
   "estimated_minutes": 90,
   "depth_level": 9,
   "position_x": 672.0,
   "position_y": 1044.0,
   "order_in_level": 3,
   "learning_objectives": "[\"能够用自己的话解释“Migration、Seed 与 Schema 演进”解决的问题与适用边界\", \"能够在 NestJS 后端中实现并验证“Migration、Seed 与 Schema 演进”的最小闭环\"]",
   "key_concepts": "[\"Migration、Seed 与 Schema 演进\", \"NestJS\", \"生产级后端\"]",
   "recommended_depth": "Use",
   "depth_rationale": "该节点是可重复使用的工程能力；学习终点是脱离逐行照抄后仍能按可靠模式完成实现。",
   "observable_evidence": "[\"能够用自己的话解释“Migration、Seed 与 Schema 演进”解决的问题与适用边界\", \"能够在 NestJS 后端中实现并验证“Migration、Seed 与 Schema 演进”的最小闭环\", \"能独立完成「Migration、Seed 与 Schema 演进」的最小可运行实现，并用测试、请求或日志证明其行为\"]"
  },
  {
   "id": "c5dd4d67-9089-409c-a38a-11a55d79ec51",
   "tree_id": "005d217e-2106-4a8f-ab84-769d48f52c08",
   "title": "模块化单体与领域边界",
   "description": "学习 模块化单体与领域边界，建立可测试、可维护、可部署的 NestJS 后端能力。",
   "icon": "compass",
   "category": "生产工程",
   "difficulty": 4,
   "estimated_minutes": 90,
   "depth_level": 9,
   "position_x": 448.0,
   "position_y": 1044.0,
   "order_in_level": 4,
   "learning_objectives": "[\"能够用自己的话解释“模块化单体与领域边界”解决的问题与适用边界\", \"能够在 NestJS 后端中实现并验证“模块化单体与领域边界”的最小闭环\"]",
   "key_concepts": "[\"模块化单体与领域边界\", \"NestJS\", \"生产级后端\"]",
   "recommended_depth": "Understand",
   "depth_rationale": "该节点会影响架构边界或故障判断；不能只会调 API，还要能解释核心机制、边界与典型错误。",
   "observable_evidence": "[\"能够用自己的话解释“模块化单体与领域边界”解决的问题与适用边界\", \"能够在 NestJS 后端中实现并验证“模块化单体与领域边界”的最小闭环\", \"能画出或口述「模块化单体与领域边界」的关键机制，解释边界并诊断一个典型错误\"]"
  },
  {
   "id": "0acc2273-60b8-4d70-b3c2-7d6d66f78385",
   "tree_id": "005d217e-2106-4a8f-ab84-769d48f52c08",
   "title": "异常与 Exception Filter",
   "description": "学习 异常与 Exception Filter，建立可测试、可维护、可部署的 NestJS 后端能力。",
   "icon": "code",
   "category": "API边界",
   "difficulty": 4,
   "estimated_minutes": 90,
   "depth_level": 10,
   "position_x": 1008.0,
   "position_y": 1160.0,
   "order_in_level": 0,
   "learning_objectives": "[\"能够用自己的话解释“异常与 Exception Filter”解决的问题与适用边界\", \"能够在 NestJS 后端中实现并验证“异常与 Exception Filter”的最小闭环\"]",
   "key_concepts": "[\"异常与 Exception Filter\", \"NestJS\", \"生产级后端\"]",
   "recommended_depth": "Use",
   "depth_rationale": "该节点是可重复使用的工程能力；学习终点是脱离逐行照抄后仍能按可靠模式完成实现。",
   "observable_evidence": "[\"能够用自己的话解释“异常与 Exception Filter”解决的问题与适用边界\", \"能够在 NestJS 后端中实现并验证“异常与 Exception Filter”的最小闭环\", \"能独立完成「异常与 Exception Filter」的最小可运行实现，并用测试、请求或日志证明其行为\"]"
  },
  {
   "id": "056e06aa-8631-4e9b-877a-fb190a3c6323",
   "tree_id": "005d217e-2106-4a8f-ab84-769d48f52c08",
   "title": "单元测试与依赖替换",
   "description": "学习 单元测试与依赖替换，建立可测试、可维护、可部署的 NestJS 后端能力。",
   "icon": "shield",
   "category": "安全与测试",
   "difficulty": 4,
   "estimated_minutes": 90,
   "depth_level": 10,
   "position_x": 784.0,
   "position_y": 1160.0,
   "order_in_level": 1,
   "learning_objectives": "[\"能够用自己的话解释“单元测试与依赖替换”解决的问题与适用边界\", \"能够在 NestJS 后端中实现并验证“单元测试与依赖替换”的最小闭环\"]",
   "key_concepts": "[\"单元测试与依赖替换\", \"NestJS\", \"生产级后端\"]",
   "recommended_depth": "Use",
   "depth_rationale": "该节点是可重复使用的工程能力；学习终点是脱离逐行照抄后仍能按可靠模式完成实现。",
   "observable_evidence": "[\"能够用自己的话解释“单元测试与依赖替换”解决的问题与适用边界\", \"能够在 NestJS 后端中实现并验证“单元测试与依赖替换”的最小闭环\", \"能独立完成「单元测试与依赖替换」的最小可运行实现，并用测试、请求或日志证明其行为\"]"
  },
  {
   "id": "5e96d7a5-4c15-48b7-83a6-cc4075df5f34",
   "tree_id": "005d217e-2106-4a8f-ab84-769d48f52c08",
   "title": "Interceptor 与 AOP",
   "description": "学习 Interceptor 与 AOP，建立可测试、可维护、可部署的 NestJS 后端能力。",
   "icon": "code",
   "category": "API边界",
   "difficulty": 4,
   "estimated_minutes": 90,
   "depth_level": 11,
   "position_x": 896.0,
   "position_y": 1276.0,
   "order_in_level": 0,
   "learning_objectives": "[\"能够用自己的话解释“Interceptor 与 AOP”解决的问题与适用边界\", \"能够在 NestJS 后端中实现并验证“Interceptor 与 AOP”的最小闭环\"]",
   "key_concepts": "[\"Interceptor 与 AOP\", \"NestJS\", \"生产级后端\"]",
   "recommended_depth": "Understand",
   "depth_rationale": "该节点会影响架构边界或故障判断；不能只会调 API，还要能解释核心机制、边界与典型错误。",
   "observable_evidence": "[\"能够用自己的话解释“Interceptor 与 AOP”解决的问题与适用边界\", \"能够在 NestJS 后端中实现并验证“Interceptor 与 AOP”的最小闭环\", \"能画出或口述「Interceptor 与 AOP」的关键机制，解释边界并诊断一个典型错误\"]"
  },
  {
   "id": "3253d579-f0b7-4d31-b524-6070775a37a1",
   "tree_id": "005d217e-2106-4a8f-ab84-769d48f52c08",
   "title": "REST 资源建模与 API 契约",
   "description": "学习 REST 资源建模与 API 契约，建立可测试、可维护、可部署的 NestJS 后端能力。",
   "icon": "code",
   "category": "API边界",
   "difficulty": 4,
   "estimated_minutes": 90,
   "depth_level": 11,
   "position_x": 1120.0,
   "position_y": 1276.0,
   "order_in_level": 1,
   "learning_objectives": "[\"能够用自己的话解释“REST 资源建模与 API 契约”解决的问题与适用边界\", \"能够在 NestJS 后端中实现并验证“REST 资源建模与 API 契约”的最小闭环\"]",
   "key_concepts": "[\"REST 资源建模与 API 契约\", \"NestJS\", \"生产级后端\"]",
   "recommended_depth": "Understand",
   "depth_rationale": "该节点会影响架构边界或故障判断；不能只会调 API，还要能解释核心机制、边界与典型错误。",
   "observable_evidence": "[\"能够用自己的话解释“REST 资源建模与 API 契约”解决的问题与适用边界\", \"能够在 NestJS 后端中实现并验证“REST 资源建模与 API 契约”的最小闭环\", \"能画出或口述「REST 资源建模与 API 契约」的关键机制，解释边界并诊断一个典型错误\"]"
  },
  {
   "id": "18c48cfa-7b5c-4020-9c2c-b77e79a7dbef",
   "tree_id": "005d217e-2106-4a8f-ab84-769d48f52c08",
   "title": "结构化日志与请求关联",
   "description": "学习 结构化日志与请求关联，建立可测试、可维护、可部署的 NestJS 后端能力。",
   "icon": "compass",
   "category": "生产工程",
   "difficulty": 4,
   "estimated_minutes": 90,
   "depth_level": 11,
   "position_x": 672.0,
   "position_y": 1276.0,
   "order_in_level": 2,
   "learning_objectives": "[\"能够用自己的话解释“结构化日志与请求关联”解决的问题与适用边界\", \"能够在 NestJS 后端中实现并验证“结构化日志与请求关联”的最小闭环\"]",
   "key_concepts": "[\"结构化日志与请求关联\", \"NestJS\", \"生产级后端\"]",
   "recommended_depth": "Use",
   "depth_rationale": "该节点是可重复使用的工程能力；学习终点是脱离逐行照抄后仍能按可靠模式完成实现。",
   "observable_evidence": "[\"能够用自己的话解释“结构化日志与请求关联”解决的问题与适用边界\", \"能够在 NestJS 后端中实现并验证“结构化日志与请求关联”的最小闭环\", \"能独立完成「结构化日志与请求关联」的最小可运行实现，并用测试、请求或日志证明其行为\"]"
  },
  {
   "id": "a017d8e0-924a-4c3d-938f-8c9ebdca6f92",
   "tree_id": "005d217e-2106-4a8f-ab84-769d48f52c08",
   "title": "自定义装饰器与 ExecutionContext",
   "description": "学习 自定义装饰器与 ExecutionContext，建立可测试、可维护、可部署的 NestJS 后端能力。",
   "icon": "code",
   "category": "API边界",
   "difficulty": 4,
   "estimated_minutes": 90,
   "depth_level": 12,
   "position_x": 672.0,
   "position_y": 1392.0,
   "order_in_level": 0,
   "learning_objectives": "[\"能够用自己的话解释“自定义装饰器与 ExecutionContext”解决的问题与适用边界\", \"能够在 NestJS 后端中实现并验证“自定义装饰器与 ExecutionContext”的最小闭环\"]",
   "key_concepts": "[\"自定义装饰器与 ExecutionContext\", \"NestJS\", \"生产级后端\"]",
   "recommended_depth": "Understand",
   "depth_rationale": "该节点会影响架构边界或故障判断；不能只会调 API，还要能解释核心机制、边界与典型错误。",
   "observable_evidence": "[\"能够用自己的话解释“自定义装饰器与 ExecutionContext”解决的问题与适用边界\", \"能够在 NestJS 后端中实现并验证“自定义装饰器与 ExecutionContext”的最小闭环\", \"能画出或口述「自定义装饰器与 ExecutionContext」的关键机制，解释边界并诊断一个典型错误\"]"
  },
  {
   "id": "b3d38af8-4dbf-4d07-a3bc-96b5992895c0",
   "tree_id": "005d217e-2106-4a8f-ab84-769d48f52c08",
   "title": "OpenAPI / Swagger",
   "description": "学习 OpenAPI / Swagger，建立可测试、可维护、可部署的 NestJS 后端能力。",
   "icon": "code",
   "category": "API边界",
   "difficulty": 4,
   "estimated_minutes": 90,
   "depth_level": 12,
   "position_x": 1344.0,
   "position_y": 1392.0,
   "order_in_level": 1,
   "learning_objectives": "[\"能够用自己的话解释“OpenAPI / Swagger”解决的问题与适用边界\", \"能够在 NestJS 后端中实现并验证“OpenAPI / Swagger”的最小闭环\"]",
   "key_concepts": "[\"OpenAPI / Swagger\", \"NestJS\", \"生产级后端\"]",
   "recommended_depth": "Use",
   "depth_rationale": "该节点是可重复使用的工程能力；学习终点是脱离逐行照抄后仍能按可靠模式完成实现。",
   "observable_evidence": "[\"能够用自己的话解释“OpenAPI / Swagger”解决的问题与适用边界\", \"能够在 NestJS 后端中实现并验证“OpenAPI / Swagger”的最小闭环\", \"能独立完成「OpenAPI / Swagger」的最小可运行实现，并用测试、请求或日志证明其行为\"]"
  },
  {
   "id": "ced48831-6fff-409a-8ed9-4389d6bb13b0",
   "tree_id": "005d217e-2106-4a8f-ab84-769d48f52c08",
   "title": "事务、并发与幂等",
   "description": "学习 事务、并发与幂等，建立可测试、可维护、可部署的 NestJS 后端能力。",
   "icon": "shield",
   "category": "数据一致性",
   "difficulty": 4,
   "estimated_minutes": 90,
   "depth_level": 12,
   "position_x": 448.0,
   "position_y": 1392.0,
   "order_in_level": 2,
   "learning_objectives": "[\"能够用自己的话解释“事务、并发与幂等”解决的问题与适用边界\", \"能够在 NestJS 后端中实现并验证“事务、并发与幂等”的最小闭环\"]",
   "key_concepts": "[\"事务、并发与幂等\", \"NestJS\", \"生产级后端\"]",
   "recommended_depth": "Transfer",
   "depth_rationale": "该节点是生产级后端的关键能力；需要在需求、流量、失败或安全约束改变时重新应用和验证。",
   "observable_evidence": "[\"能够用自己的话解释“事务、并发与幂等”解决的问题与适用边界\", \"能够在 NestJS 后端中实现并验证“事务、并发与幂等”的最小闭环\", \"能在约束变化或故障注入后重新设计「事务、并发与幂等」，并用自动化证据验证关键性质\"]"
  },
  {
   "id": "bb3cffe2-8924-4584-ba84-a890a09d8c35",
   "tree_id": "005d217e-2106-4a8f-ab84-769d48f52c08",
   "title": "序列化与数据泄漏防护",
   "description": "学习 序列化与数据泄漏防护，建立可测试、可维护、可部署的 NestJS 后端能力。",
   "icon": "shield",
   "category": "数据一致性",
   "difficulty": 4,
   "estimated_minutes": 90,
   "depth_level": 12,
   "position_x": 1120.0,
   "position_y": 1392.0,
   "order_in_level": 3,
   "learning_objectives": "[\"能够用自己的话解释“序列化与数据泄漏防护”解决的问题与适用边界\", \"能够在 NestJS 后端中实现并验证“序列化与数据泄漏防护”的最小闭环\"]",
   "key_concepts": "[\"序列化与数据泄漏防护\", \"NestJS\", \"生产级后端\"]",
   "recommended_depth": "Use",
   "depth_rationale": "该节点是可重复使用的工程能力；学习终点是脱离逐行照抄后仍能按可靠模式完成实现。",
   "observable_evidence": "[\"能够用自己的话解释“序列化与数据泄漏防护”解决的问题与适用边界\", \"能够在 NestJS 后端中实现并验证“序列化与数据泄漏防护”的最小闭环\", \"能独立完成「序列化与数据泄漏防护」的最小可运行实现，并用测试、请求或日志证明其行为\"]"
  },
  {
   "id": "901ccee3-3493-4256-bd1e-92a752ec7501",
   "tree_id": "005d217e-2106-4a8f-ab84-769d48f52c08",
   "title": "外部 HTTP 集成与韧性",
   "description": "学习 外部 HTTP 集成与韧性，建立可测试、可维护、可部署的 NestJS 后端能力。",
   "icon": "compass",
   "category": "生产工程",
   "difficulty": 4,
   "estimated_minutes": 90,
   "depth_level": 12,
   "position_x": 896.0,
   "position_y": 1392.0,
   "order_in_level": 4,
   "learning_objectives": "[\"能够用自己的话解释“外部 HTTP 集成与韧性”解决的问题与适用边界\", \"能够在 NestJS 后端中实现并验证“外部 HTTP 集成与韧性”的最小闭环\"]",
   "key_concepts": "[\"外部 HTTP 集成与韧性\", \"NestJS\", \"生产级后端\"]",
   "recommended_depth": "Transfer",
   "depth_rationale": "该节点是生产级后端的关键能力；需要在需求、流量、失败或安全约束改变时重新应用和验证。",
   "observable_evidence": "[\"能够用自己的话解释“外部 HTTP 集成与韧性”解决的问题与适用边界\", \"能够在 NestJS 后端中实现并验证“外部 HTTP 集成与韧性”的最小闭环\", \"能在约束变化或故障注入后重新设计「外部 HTTP 集成与韧性」，并用自动化证据验证关键性质\"]"
  },
  {
   "id": "366f9417-f6dd-475e-a3dc-1321a8ca5615",
   "tree_id": "005d217e-2106-4a8f-ab84-769d48f52c08",
   "title": "身份认证：密码与 JWT",
   "description": "学习 身份认证：密码与 JWT，建立可测试、可维护、可部署的 NestJS 后端能力。",
   "icon": "shield",
   "category": "安全与测试",
   "difficulty": 5,
   "estimated_minutes": 90,
   "depth_level": 13,
   "position_x": 1568.0,
   "position_y": 1508.0,
   "order_in_level": 0,
   "learning_objectives": "[\"能够用自己的话解释“身份认证：密码与 JWT”解决的问题与适用边界\", \"能够在 NestJS 后端中实现并验证“身份认证：密码与 JWT”的最小闭环\"]",
   "key_concepts": "[\"身份认证：密码与 JWT\", \"NestJS\", \"生产级后端\"]",
   "recommended_depth": "Use",
   "depth_rationale": "该节点是可重复使用的工程能力；学习终点是脱离逐行照抄后仍能按可靠模式完成实现。",
   "observable_evidence": "[\"能够用自己的话解释“身份认证：密码与 JWT”解决的问题与适用边界\", \"能够在 NestJS 后端中实现并验证“身份认证：密码与 JWT”的最小闭环\", \"能独立完成「身份认证：密码与 JWT」的最小可运行实现，并用测试、请求或日志证明其行为\"]"
  },
  {
   "id": "640b80be-c1b8-4575-a1e3-e265a58e2a97",
   "tree_id": "005d217e-2106-4a8f-ab84-769d48f52c08",
   "title": "数据库集成测试",
   "description": "学习 数据库集成测试，建立可测试、可维护、可部署的 NestJS 后端能力。",
   "icon": "shield",
   "category": "安全与测试",
   "difficulty": 5,
   "estimated_minutes": 90,
   "depth_level": 13,
   "position_x": 896.0,
   "position_y": 1508.0,
   "order_in_level": 1,
   "learning_objectives": "[\"能够用自己的话解释“数据库集成测试”解决的问题与适用边界\", \"能够在 NestJS 后端中实现并验证“数据库集成测试”的最小闭环\"]",
   "key_concepts": "[\"数据库集成测试\", \"NestJS\", \"生产级后端\"]",
   "recommended_depth": "Use",
   "depth_rationale": "该节点是可重复使用的工程能力；学习终点是脱离逐行照抄后仍能按可靠模式完成实现。",
   "observable_evidence": "[\"能够用自己的话解释“数据库集成测试”解决的问题与适用边界\", \"能够在 NestJS 后端中实现并验证“数据库集成测试”的最小闭环\", \"能独立完成「数据库集成测试」的最小可运行实现，并用测试、请求或日志证明其行为\"]"
  },
  {
   "id": "ebb592f5-81e0-403f-8922-a0edbb258d1c",
   "tree_id": "005d217e-2106-4a8f-ab84-769d48f52c08",
   "title": "事件、定时任务与后台队列",
   "description": "学习 事件、定时任务与后台队列，建立可测试、可维护、可部署的 NestJS 后端能力。",
   "icon": "compass",
   "category": "生产工程",
   "difficulty": 5,
   "estimated_minutes": 90,
   "depth_level": 13,
   "position_x": 1344.0,
   "position_y": 1508.0,
   "order_in_level": 2,
   "learning_objectives": "[\"能够用自己的话解释“事件、定时任务与后台队列”解决的问题与适用边界\", \"能够在 NestJS 后端中实现并验证“事件、定时任务与后台队列”的最小闭环\"]",
   "key_concepts": "[\"事件、定时任务与后台队列\", \"NestJS\", \"生产级后端\"]",
   "recommended_depth": "Use",
   "depth_rationale": "该节点是可重复使用的工程能力；学习终点是脱离逐行照抄后仍能按可靠模式完成实现。",
   "observable_evidence": "[\"能够用自己的话解释“事件、定时任务与后台队列”解决的问题与适用边界\", \"能够在 NestJS 后端中实现并验证“事件、定时任务与后台队列”的最小闭环\", \"能独立完成「事件、定时任务与后台队列」的最小可运行实现，并用测试、请求或日志证明其行为\"]"
  },
  {
   "id": "56d55022-f1f4-4b49-8afc-e27ca2dad6e9",
   "tree_id": "005d217e-2106-4a8f-ab84-769d48f52c08",
   "title": "缓存与 Redis",
   "description": "学习 缓存与 Redis，建立可测试、可维护、可部署的 NestJS 后端能力。",
   "icon": "compass",
   "category": "生产工程",
   "difficulty": 5,
   "estimated_minutes": 90,
   "depth_level": 13,
   "position_x": 1120.0,
   "position_y": 1508.0,
   "order_in_level": 3,
   "learning_objectives": "[\"能够用自己的话解释“缓存与 Redis”解决的问题与适用边界\", \"能够在 NestJS 后端中实现并验证“缓存与 Redis”的最小闭环\"]",
   "key_concepts": "[\"缓存与 Redis\", \"NestJS\", \"生产级后端\"]",
   "recommended_depth": "Use",
   "depth_rationale": "该节点是可重复使用的工程能力；学习终点是脱离逐行照抄后仍能按可靠模式完成实现。",
   "observable_evidence": "[\"能够用自己的话解释“缓存与 Redis”解决的问题与适用边界\", \"能够在 NestJS 后端中实现并验证“缓存与 Redis”的最小闭环\", \"能独立完成「缓存与 Redis」的最小可运行实现，并用测试、请求或日志证明其行为\"]"
  },
  {
   "id": "f3200ee6-d3ab-4849-bbcb-ed6954c65b0f",
   "tree_id": "005d217e-2106-4a8f-ab84-769d48f52c08",
   "title": "高级 DI、动态模块与作用域",
   "description": "按真实项目需求进入的高级分支：高级 DI、动态模块与作用域，不阻塞模块化单体主线。",
   "icon": "compass",
   "category": "延后分支",
   "difficulty": 5,
   "estimated_minutes": 180,
   "depth_level": 13,
   "position_x": 224.0,
   "position_y": 1508.0,
   "order_in_level": 4,
   "learning_objectives": "[\"能够用自己的话解释“高级 DI、动态模块与作用域”解决的问题与适用边界\", \"能够在 NestJS 后端中实现并验证“高级 DI、动态模块与作用域”的最小闭环\"]",
   "key_concepts": "[\"高级 DI、动态模块与作用域\", \"NestJS\", \"条件性高级能力\"]",
   "recommended_depth": "Understand",
   "depth_rationale": "该节点会影响架构边界或故障判断；不能只会调 API，还要能解释核心机制、边界与典型错误。",
   "observable_evidence": "[\"能够用自己的话解释“高级 DI、动态模块与作用域”解决的问题与适用边界\", \"能够在 NestJS 后端中实现并验证“高级 DI、动态模块与作用域”的最小闭环\", \"能画出或口述「高级 DI、动态模块与作用域」的关键机制，解释边界并诊断一个典型错误\"]"
  },
  {
   "id": "f5232c8c-c342-44d3-a56c-1926c7ac0ff8",
   "tree_id": "005d217e-2106-4a8f-ab84-769d48f52c08",
   "title": "Hexagonal Architecture 与 DDD",
   "description": "按真实项目需求进入的高级分支：Hexagonal Architecture 与 DDD，不阻塞模块化单体主线。",
   "icon": "compass",
   "category": "延后分支",
   "difficulty": 5,
   "estimated_minutes": 180,
   "depth_level": 13,
   "position_x": 672.0,
   "position_y": 1508.0,
   "order_in_level": 5,
   "learning_objectives": "[\"能够用自己的话解释“Hexagonal Architecture 与 DDD”解决的问题与适用边界\", \"能够在 NestJS 后端中实现并验证“Hexagonal Architecture 与 DDD”的最小闭环\"]",
   "key_concepts": "[\"Hexagonal Architecture 与 DDD\", \"NestJS\", \"条件性高级能力\"]",
   "recommended_depth": "Understand",
   "depth_rationale": "该节点会影响架构边界或故障判断；不能只会调 API，还要能解释核心机制、边界与典型错误。",
   "observable_evidence": "[\"能够用自己的话解释“Hexagonal Architecture 与 DDD”解决的问题与适用边界\", \"能够在 NestJS 后端中实现并验证“Hexagonal Architecture 与 DDD”的最小闭环\", \"能画出或口述「Hexagonal Architecture 与 DDD」的关键机制，解释边界并诊断一个典型错误\"]"
  },
  {
   "id": "d95e6e50-a6db-4d88-9706-c00fb276fbcb",
   "tree_id": "005d217e-2106-4a8f-ab84-769d48f52c08",
   "title": "模块边界、业务用例与 API 契约",
   "description": "把用户、会话、Agent 运行、工具、用量等能力分开；明确 HTTP 资源、状态码、分页、版本和稳定错误格式。\nController、数据库与第三方 SDK 互相缠绕；一次模型或数据库变更扩散全局；客户端无法稳定集成。",
   "icon": "tool",
   "category": "产品后端能力",
   "difficulty": 4,
   "estimated_minutes": 120,
   "depth_level": 13,
   "position_x": 448.0,
   "position_y": 1508.0,
   "order_in_level": 6,
   "learning_objectives": "[\"主要模块只有显式导出\", \"业务规则可脱离 HTTP 测试\", \"OpenAPI 可驱动关键用户旅程\", \"破坏性契约变更会被测试阻止。\"]",
   "key_concepts": "[\"A1\", \"模块边界、业务用例与 API 契约\", \"产品后端能力\"]",
   "recommended_depth": "Transfer",
   "depth_rationale": "该节点是生产级后端的关键能力；需要在需求、流量、失败或安全约束改变时重新应用和验证。",
   "observable_evidence": "[\"主要模块只有显式导出\", \"业务规则可脱离 HTTP 测试\", \"OpenAPI 可驱动关键用户旅程\", \"破坏性契约变更会被测试阻止。\", \"能在约束变化或故障注入后重新设计「模块边界、业务用例与 API 契约」，并用自动化证据验证关键性质\"]"
  },
  {
   "id": "994dc725-0d10-4f0a-94a1-d059e967496c",
   "tree_id": "005d217e-2106-4a8f-ab84-769d48f52c08",
   "title": "输入验证、输出序列化与一致错误语义",
   "description": "把网络输入视为不可信；拒绝未知字段、限制大小和格式；不返回密码、密钥、内部堆栈或跨用户数据。\n脏数据进入数据库；mass assignment；内部细节泄露；前端无法区分业务拒绝、暂时失败和系统故障。",
   "icon": "tool",
   "category": "产品后端能力",
   "difficulty": 4,
   "estimated_minutes": 120,
   "depth_level": 13,
   "position_x": 1792.0,
   "position_y": 1508.0,
   "order_in_level": 7,
   "learning_objectives": "[\"无效、超长和多余字段有负向测试\", \"错误响应含稳定 code/correlation id\", \"敏感字段永不出现在 API 与日志快照中。\"]",
   "key_concepts": "[\"A3\", \"输入验证、输出序列化与一致错误语义\", \"产品后端能力\"]",
   "recommended_depth": "Understand",
   "depth_rationale": "该节点会影响架构边界或故障判断；不能只会调 API，还要能解释核心机制、边界与典型错误。",
   "observable_evidence": "[\"无效、超长和多余字段有负向测试\", \"错误响应含稳定 code/correlation id\", \"敏感字段永不出现在 API 与日志快照中。\", \"能画出或口述「输入验证、输出序列化与一致错误语义」的关键机制，解释边界并诊断一个典型错误\"]"
  },
  {
   "id": "3dbc4f38-22d1-4100-929d-d7ed83f9ad4d",
   "tree_id": "005d217e-2106-4a8f-ab84-769d48f52c08",
   "title": "关系数据建模、约束、事务与迁移",
   "description": "可靠保存用户、会话、run、消息、工具调用、用量和审计记录；用约束和事务维护跨表不变量。\n重复扣费、孤儿消息、run 状态矛盾、并发更新丢失；生产数据库无法安全升级或回滚。",
   "icon": "tool",
   "category": "产品后端能力",
   "difficulty": 4,
   "estimated_minutes": 120,
   "depth_level": 13,
   "position_x": 0.0,
   "position_y": 1508.0,
   "order_in_level": 8,
   "learning_objectives": "[\"空库可由 migration 重建\", \"并发测试证明唯一约束和状态转换有效\", \"故意中断事务后无半成品\", \"慢查询可由执行计划解释。\"]",
   "key_concepts": "[\"A4\", \"关系数据建模、约束、事务与迁移\", \"产品后端能力\"]",
   "recommended_depth": "Transfer",
   "depth_rationale": "该节点是生产级后端的关键能力；需要在需求、流量、失败或安全约束改变时重新应用和验证。",
   "observable_evidence": "[\"空库可由 migration 重建\", \"并发测试证明唯一约束和状态转换有效\", \"故意中断事务后无半成品\", \"慢查询可由执行计划解释。\", \"能在约束变化或故障注入后重新设计「关系数据建模、约束、事务与迁移」，并用自动化证据验证关键性质\"]"
  },
  {
   "id": "d3136c72-f4c8-453a-9aae-c65747c1265e",
   "tree_id": "005d217e-2106-4a8f-ab84-769d48f52c08",
   "title": "Refresh Token、Session 与撤销",
   "description": "学习 Refresh Token、Session 与撤销，建立可测试、可维护、可部署的 NestJS 后端能力。",
   "icon": "shield",
   "category": "安全与测试",
   "difficulty": 5,
   "estimated_minutes": 90,
   "depth_level": 14,
   "position_x": 896.0,
   "position_y": 1624.0,
   "order_in_level": 0,
   "learning_objectives": "[\"能够用自己的话解释“Refresh Token、Session 与撤销”解决的问题与适用边界\", \"能够在 NestJS 后端中实现并验证“Refresh Token、Session 与撤销”的最小闭环\"]",
   "key_concepts": "[\"Refresh Token、Session 与撤销\", \"NestJS\", \"生产级后端\"]",
   "recommended_depth": "Understand",
   "depth_rationale": "该节点会影响架构边界或故障判断；不能只会调 API，还要能解释核心机制、边界与典型错误。",
   "observable_evidence": "[\"能够用自己的话解释“Refresh Token、Session 与撤销”解决的问题与适用边界\", \"能够在 NestJS 后端中实现并验证“Refresh Token、Session 与撤销”的最小闭环\", \"能画出或口述「Refresh Token、Session 与撤销」的关键机制，解释边界并诊断一个典型错误\"]"
  },
  {
   "id": "af38e816-d01a-4549-964d-e86377211ca9",
   "tree_id": "005d217e-2106-4a8f-ab84-769d48f52c08",
   "title": "授权：RBAC、Claims 与资源权限",
   "description": "学习 授权：RBAC、Claims 与资源权限，建立可测试、可维护、可部署的 NestJS 后端能力。",
   "icon": "shield",
   "category": "安全与测试",
   "difficulty": 5,
   "estimated_minutes": 90,
   "depth_level": 14,
   "position_x": 1120.0,
   "position_y": 1624.0,
   "order_in_level": 1,
   "learning_objectives": "[\"能够用自己的话解释“授权：RBAC、Claims 与资源权限”解决的问题与适用边界\", \"能够在 NestJS 后端中实现并验证“授权：RBAC、Claims 与资源权限”的最小闭环\"]",
   "key_concepts": "[\"授权：RBAC、Claims 与资源权限\", \"NestJS\", \"生产级后端\"]",
   "recommended_depth": "Understand",
   "depth_rationale": "该节点会影响架构边界或故障判断；不能只会调 API，还要能解释核心机制、边界与典型错误。",
   "observable_evidence": "[\"能够用自己的话解释“授权：RBAC、Claims 与资源权限”解决的问题与适用边界\", \"能够在 NestJS 后端中实现并验证“授权：RBAC、Claims 与资源权限”的最小闭环\", \"能画出或口述「授权：RBAC、Claims 与资源权限」的关键机制，解释边界并诊断一个典型错误\"]"
  },
  {
   "id": "9aa1dd2e-93e2-4304-af99-eca50c382775",
   "tree_id": "005d217e-2106-4a8f-ab84-769d48f52c08",
   "title": "健康检查、生命周期与优雅停机",
   "description": "学习 健康检查、生命周期与优雅停机，建立可测试、可维护、可部署的 NestJS 后端能力。",
   "icon": "compass",
   "category": "生产工程",
   "difficulty": 5,
   "estimated_minutes": 90,
   "depth_level": 14,
   "position_x": 1344.0,
   "position_y": 1624.0,
   "order_in_level": 2,
   "learning_objectives": "[\"能够用自己的话解释“健康检查、生命周期与优雅停机”解决的问题与适用边界\", \"能够在 NestJS 后端中实现并验证“健康检查、生命周期与优雅停机”的最小闭环\"]",
   "key_concepts": "[\"健康检查、生命周期与优雅停机\", \"NestJS\", \"生产级后端\"]",
   "recommended_depth": "Use",
   "depth_rationale": "该节点是可重复使用的工程能力；学习终点是脱离逐行照抄后仍能按可靠模式完成实现。",
   "observable_evidence": "[\"能够用自己的话解释“健康检查、生命周期与优雅停机”解决的问题与适用边界\", \"能够在 NestJS 后端中实现并验证“健康检查、生命周期与优雅停机”的最小闭环\", \"能独立完成「健康检查、生命周期与优雅停机」的最小可运行实现，并用测试、请求或日志证明其行为\"]"
  },
  {
   "id": "decf25d6-3678-4346-8c12-61cfde63ac53",
   "tree_id": "005d217e-2106-4a8f-ab84-769d48f52c08",
   "title": "CQRS 与领域事件",
   "description": "按真实项目需求进入的高级分支：CQRS 与领域事件，不阻塞模块化单体主线。",
   "icon": "compass",
   "category": "延后分支",
   "difficulty": 5,
   "estimated_minutes": 180,
   "depth_level": 14,
   "position_x": 672.0,
   "position_y": 1624.0,
   "order_in_level": 3,
   "learning_objectives": "[\"能够用自己的话解释“CQRS 与领域事件”解决的问题与适用边界\", \"能够在 NestJS 后端中实现并验证“CQRS 与领域事件”的最小闭环\"]",
   "key_concepts": "[\"CQRS 与领域事件\", \"NestJS\", \"条件性高级能力\"]",
   "recommended_depth": "Recognize",
   "depth_rationale": "该节点在当前路线中主要用于建立边界意识；现阶段应能识别它何时需要、何时可以延后。",
   "observable_evidence": "[\"能够用自己的话解释“CQRS 与领域事件”解决的问题与适用边界\", \"能够在 NestJS 后端中实现并验证“CQRS 与领域事件”的最小闭环\", \"面对需求或架构图时，能指出「CQRS 与领域事件」的用途、触发条件和可延后边界\"]"
  },
  {
   "id": "3d8dbd34-0ee1-4e4c-aceb-1225d3247110",
   "tree_id": "005d217e-2106-4a8f-ab84-769d48f52c08",
   "title": "Nest Microservice 基础",
   "description": "按真实项目需求进入的高级分支：Nest Microservice 基础，不阻塞模块化单体主线。",
   "icon": "compass",
   "category": "延后分支",
   "difficulty": 5,
   "estimated_minutes": 180,
   "depth_level": 14,
   "position_x": 448.0,
   "position_y": 1624.0,
   "order_in_level": 4,
   "learning_objectives": "[\"能够用自己的话解释“Nest Microservice 基础”解决的问题与适用边界\", \"能够在 NestJS 后端中实现并验证“Nest Microservice 基础”的最小闭环\"]",
   "key_concepts": "[\"Nest Microservice 基础\", \"NestJS\", \"条件性高级能力\"]",
   "recommended_depth": "Recognize",
   "depth_rationale": "该节点在当前路线中主要用于建立边界意识；现阶段应能识别它何时需要、何时可以延后。",
   "observable_evidence": "[\"能够用自己的话解释“Nest Microservice 基础”解决的问题与适用边界\", \"能够在 NestJS 后端中实现并验证“Nest Microservice 基础”的最小闭环\", \"面对需求或架构图时，能指出「Nest Microservice 基础」的用途、触发条件和可延后边界\"]"
  },
  {
   "id": "ba297c75-e891-4042-a6d9-a3e9eefa3b1a",
   "tree_id": "005d217e-2106-4a8f-ab84-769d48f52c08",
   "title": "Web 安全基线",
   "description": "学习 Web 安全基线，建立可测试、可维护、可部署的 NestJS 后端能力。",
   "icon": "shield",
   "category": "安全与测试",
   "difficulty": 5,
   "estimated_minutes": 90,
   "depth_level": 15,
   "position_x": 1008.0,
   "position_y": 1740.0,
   "order_in_level": 0,
   "learning_objectives": "[\"能够用自己的话解释“Web 安全基线”解决的问题与适用边界\", \"能够在 NestJS 后端中实现并验证“Web 安全基线”的最小闭环\"]",
   "key_concepts": "[\"Web 安全基线\", \"NestJS\", \"生产级后端\"]",
   "recommended_depth": "Understand",
   "depth_rationale": "该节点会影响架构边界或故障判断；不能只会调 API，还要能解释核心机制、边界与典型错误。",
   "observable_evidence": "[\"能够用自己的话解释“Web 安全基线”解决的问题与适用边界\", \"能够在 NestJS 后端中实现并验证“Web 安全基线”的最小闭环\", \"能画出或口述「Web 安全基线」的关键机制，解释边界并诊断一个典型错误\"]"
  },
  {
   "id": "7f6cc719-2108-4f50-83b7-6e80840830fd",
   "tree_id": "005d217e-2106-4a8f-ab84-769d48f52c08",
   "title": "E2E 与契约测试",
   "description": "学习 E2E 与契约测试，建立可测试、可维护、可部署的 NestJS 后端能力。",
   "icon": "shield",
   "category": "安全与测试",
   "difficulty": 5,
   "estimated_minutes": 90,
   "depth_level": 15,
   "position_x": 784.0,
   "position_y": 1740.0,
   "order_in_level": 1,
   "learning_objectives": "[\"能够用自己的话解释“E2E 与契约测试”解决的问题与适用边界\", \"能够在 NestJS 后端中实现并验证“E2E 与契约测试”的最小闭环\"]",
   "key_concepts": "[\"E2E 与契约测试\", \"NestJS\", \"生产级后端\"]",
   "recommended_depth": "Use",
   "depth_rationale": "该节点是可重复使用的工程能力；学习终点是脱离逐行照抄后仍能按可靠模式完成实现。",
   "observable_evidence": "[\"能够用自己的话解释“E2E 与契约测试”解决的问题与适用边界\", \"能够在 NestJS 后端中实现并验证“E2E 与契约测试”的最小闭环\", \"能独立完成「E2E 与契约测试」的最小可运行实现，并用测试、请求或日志证明其行为\"]"
  },
  {
   "id": "919f5095-a87f-4419-849b-af9c7d14a837",
   "tree_id": "005d217e-2106-4a8f-ab84-769d48f52c08",
   "title": "Metrics、Tracing 与可观测性",
   "description": "学习 Metrics、Tracing 与可观测性，建立可测试、可维护、可部署的 NestJS 后端能力。",
   "icon": "compass",
   "category": "生产工程",
   "difficulty": 5,
   "estimated_minutes": 90,
   "depth_level": 15,
   "position_x": 1232.0,
   "position_y": 1740.0,
   "order_in_level": 2,
   "learning_objectives": "[\"能够用自己的话解释“Metrics、Tracing 与可观测性”解决的问题与适用边界\", \"能够在 NestJS 后端中实现并验证“Metrics、Tracing 与可观测性”的最小闭环\"]",
   "key_concepts": "[\"Metrics、Tracing 与可观测性\", \"NestJS\", \"生产级后端\"]",
   "recommended_depth": "Transfer",
   "depth_rationale": "该节点是生产级后端的关键能力；需要在需求、流量、失败或安全约束改变时重新应用和验证。",
   "observable_evidence": "[\"能够用自己的话解释“Metrics、Tracing 与可观测性”解决的问题与适用边界\", \"能够在 NestJS 后端中实现并验证“Metrics、Tracing 与可观测性”的最小闭环\", \"能在约束变化或故障注入后重新设计「Metrics、Tracing 与可观测性」，并用自动化证据验证关键性质\"]"
  },
  {
   "id": "172a8c43-e1eb-406b-941d-9b3a28cfe470",
   "tree_id": "005d217e-2106-4a8f-ab84-769d48f52c08",
   "title": "消息语义与 Broker 可靠性",
   "description": "按真实项目需求进入的高级分支：消息语义与 Broker 可靠性，不阻塞模块化单体主线。",
   "icon": "compass",
   "category": "延后分支",
   "difficulty": 5,
   "estimated_minutes": 180,
   "depth_level": 15,
   "position_x": 560.0,
   "position_y": 1740.0,
   "order_in_level": 3,
   "learning_objectives": "[\"能够用自己的话解释“消息语义与 Broker 可靠性”解决的问题与适用边界\", \"能够在 NestJS 后端中实现并验证“消息语义与 Broker 可靠性”的最小闭环\"]",
   "key_concepts": "[\"消息语义与 Broker 可靠性\", \"NestJS\", \"条件性高级能力\"]",
   "recommended_depth": "Understand",
   "depth_rationale": "该节点会影响架构边界或故障判断；不能只会调 API，还要能解释核心机制、边界与典型错误。",
   "observable_evidence": "[\"能够用自己的话解释“消息语义与 Broker 可靠性”解决的问题与适用边界\", \"能够在 NestJS 后端中实现并验证“消息语义与 Broker 可靠性”的最小闭环\", \"能画出或口述「消息语义与 Broker 可靠性」的关键机制，解释边界并诊断一个典型错误\"]"
  },
  {
   "id": "fe35e499-b99d-4a81-9698-041f75a32c8a",
   "tree_id": "005d217e-2106-4a8f-ab84-769d48f52c08",
   "title": "限流与滥用防护",
   "description": "学习 限流与滥用防护，建立可测试、可维护、可部署的 NestJS 后端能力。",
   "icon": "shield",
   "category": "安全与测试",
   "difficulty": 5,
   "estimated_minutes": 90,
   "depth_level": 16,
   "position_x": 1008.0,
   "position_y": 1856.0,
   "order_in_level": 0,
   "learning_objectives": "[\"能够用自己的话解释“限流与滥用防护”解决的问题与适用边界\", \"能够在 NestJS 后端中实现并验证“限流与滥用防护”的最小闭环\"]",
   "key_concepts": "[\"限流与滥用防护\", \"NestJS\", \"生产级后端\"]",
   "recommended_depth": "Use",
   "depth_rationale": "该节点是可重复使用的工程能力；学习终点是脱离逐行照抄后仍能按可靠模式完成实现。",
   "observable_evidence": "[\"能够用自己的话解释“限流与滥用防护”解决的问题与适用边界\", \"能够在 NestJS 后端中实现并验证“限流与滥用防护”的最小闭环\", \"能独立完成「限流与滥用防护」的最小可运行实现，并用测试、请求或日志证明其行为\"]"
  },
  {
   "id": "ac66a022-b873-46c9-bd81-cc74fcf58117",
   "tree_id": "005d217e-2106-4a8f-ab84-769d48f52c08",
   "title": "性能、Fastify 与负载测试",
   "description": "学习 性能、Fastify 与负载测试，建立可测试、可维护、可部署的 NestJS 后端能力。",
   "icon": "compass",
   "category": "生产工程",
   "difficulty": 5,
   "estimated_minutes": 90,
   "depth_level": 16,
   "position_x": 1456.0,
   "position_y": 1856.0,
   "order_in_level": 1,
   "learning_objectives": "[\"能够用自己的话解释“性能、Fastify 与负载测试”解决的问题与适用边界\", \"能够在 NestJS 后端中实现并验证“性能、Fastify 与负载测试”的最小闭环\"]",
   "key_concepts": "[\"性能、Fastify 与负载测试\", \"NestJS\", \"生产级后端\"]",
   "recommended_depth": "Transfer",
   "depth_rationale": "该节点是生产级后端的关键能力；需要在需求、流量、失败或安全约束改变时重新应用和验证。",
   "observable_evidence": "[\"能够用自己的话解释“性能、Fastify 与负载测试”解决的问题与适用边界\", \"能够在 NestJS 后端中实现并验证“性能、Fastify 与负载测试”的最小闭环\", \"能在约束变化或故障注入后重新设计「性能、Fastify 与负载测试」，并用自动化证据验证关键性质\"]"
  },
  {
   "id": "3a63d4b5-15fc-4fc4-b6f7-deacabb8828a",
   "tree_id": "005d217e-2106-4a8f-ab84-769d48f52c08",
   "title": "WebSocket 与 SSE",
   "description": "按真实项目需求进入的高级分支：WebSocket 与 SSE，不阻塞模块化单体主线。",
   "icon": "compass",
   "category": "延后分支",
   "difficulty": 5,
   "estimated_minutes": 180,
   "depth_level": 16,
   "position_x": 784.0,
   "position_y": 1856.0,
   "order_in_level": 2,
   "learning_objectives": "[\"能够用自己的话解释“WebSocket 与 SSE”解决的问题与适用边界\", \"能够在 NestJS 后端中实现并验证“WebSocket 与 SSE”的最小闭环\"]",
   "key_concepts": "[\"WebSocket 与 SSE\", \"NestJS\", \"条件性高级能力\"]",
   "recommended_depth": "Use",
   "depth_rationale": "该节点是可重复使用的工程能力；学习终点是脱离逐行照抄后仍能按可靠模式完成实现。",
   "observable_evidence": "[\"能够用自己的话解释“WebSocket 与 SSE”解决的问题与适用边界\", \"能够在 NestJS 后端中实现并验证“WebSocket 与 SSE”的最小闭环\", \"能独立完成「WebSocket 与 SSE」的最小可运行实现，并用测试、请求或日志证明其行为\"]"
  },
  {
   "id": "f61865b8-07cf-4ead-8e0a-c14ab61aaee3",
   "tree_id": "005d217e-2106-4a8f-ab84-769d48f52c08",
   "title": "GraphQL 与 Federation",
   "description": "按真实项目需求进入的高级分支：GraphQL 与 Federation，不阻塞模块化单体主线。",
   "icon": "compass",
   "category": "延后分支",
   "difficulty": 5,
   "estimated_minutes": 180,
   "depth_level": 16,
   "position_x": 336.0,
   "position_y": 1856.0,
   "order_in_level": 3,
   "learning_objectives": "[\"能够用自己的话解释“GraphQL 与 Federation”解决的问题与适用边界\", \"能够在 NestJS 后端中实现并验证“GraphQL 与 Federation”的最小闭环\"]",
   "key_concepts": "[\"GraphQL 与 Federation\", \"NestJS\", \"条件性高级能力\"]",
   "recommended_depth": "Recognize",
   "depth_rationale": "该节点在当前路线中主要用于建立边界意识；现阶段应能识别它何时需要、何时可以延后。",
   "observable_evidence": "[\"能够用自己的话解释“GraphQL 与 Federation”解决的问题与适用边界\", \"能够在 NestJS 后端中实现并验证“GraphQL 与 Federation”的最小闭环\", \"面对需求或架构图时，能指出「GraphQL 与 Federation」的用途、触发条件和可延后边界\"]"
  },
  {
   "id": "b6dec9d7-cb95-4f3c-b12a-1c01bbe71b82",
   "tree_id": "005d217e-2106-4a8f-ab84-769d48f52c08",
   "title": "gRPC 与类型化服务契约",
   "description": "按真实项目需求进入的高级分支：gRPC 与类型化服务契约，不阻塞模块化单体主线。",
   "icon": "compass",
   "category": "延后分支",
   "difficulty": 5,
   "estimated_minutes": 180,
   "depth_level": 16,
   "position_x": 112.0,
   "position_y": 1856.0,
   "order_in_level": 4,
   "learning_objectives": "[\"能够用自己的话解释“gRPC 与类型化服务契约”解决的问题与适用边界\", \"能够在 NestJS 后端中实现并验证“gRPC 与类型化服务契约”的最小闭环\"]",
   "key_concepts": "[\"gRPC 与类型化服务契约\", \"NestJS\", \"条件性高级能力\"]",
   "recommended_depth": "Recognize",
   "depth_rationale": "该节点在当前路线中主要用于建立边界意识；现阶段应能识别它何时需要、何时可以延后。",
   "observable_evidence": "[\"能够用自己的话解释“gRPC 与类型化服务契约”解决的问题与适用边界\", \"能够在 NestJS 后端中实现并验证“gRPC 与类型化服务契约”的最小闭环\", \"面对需求或架构图时，能指出「gRPC 与类型化服务契约」的用途、触发条件和可延后边界\"]"
  },
  {
   "id": "34a4b130-5ed5-4cb1-a36c-d6ce73654628",
   "tree_id": "005d217e-2106-4a8f-ab84-769d48f52c08",
   "title": "身份认证、授权与多用户数据隔离",
   "description": "确认“谁在调用”、能操作哪个资源；每次查询和写入都受资源所有权或角色/权限约束。\n跨用户读取会话、越权调用工具、普通用户执行管理操作；AI 的 system prompt 不能弥补这些漏洞。",
   "icon": "tool",
   "category": "产品后端能力",
   "difficulty": 4,
   "estimated_minutes": 120,
   "depth_level": 16,
   "position_x": 560.0,
   "position_y": 1856.0,
   "order_in_level": 5,
   "learning_objectives": "[\"缺失/过期/伪造凭证均被拒\", \"用户 A 无法用枚举 ID 访问用户 B 的会话和运行\", \"工具端再次校验权限而非信任模型决定。\"]",
   "key_concepts": "[\"A2\", \"身份认证、授权与多用户数据隔离\", \"产品后端能力\"]",
   "recommended_depth": "Transfer",
   "depth_rationale": "该节点是生产级后端的关键能力；需要在需求、流量、失败或安全约束改变时重新应用和验证。",
   "observable_evidence": "[\"缺失/过期/伪造凭证均被拒\", \"用户 A 无法用枚举 ID 访问用户 B 的会话和运行\", \"工具端再次校验权限而非信任模型决定。\", \"能在约束变化或故障注入后重新设计「身份认证、授权与多用户数据隔离」，并用自动化证据验证关键性质\"]"
  },
  {
   "id": "6ce1a409-bb5a-4e74-bf27-bdb3dcd66e91",
   "tree_id": "005d217e-2106-4a8f-ab84-769d48f52c08",
   "title": "配置、密钥与环境隔离",
   "description": "让同一构建产物安全运行于开发、测试、预发布和生产；密钥由外部注入并可轮换。\n密钥进 Git/镜像/日志；错误环境连接生产库；缺配置后以隐蔽方式运行到一半才失败。",
   "icon": "tool",
   "category": "产品后端能力",
   "difficulty": 4,
   "estimated_minutes": 120,
   "depth_level": 16,
   "position_x": 1232.0,
   "position_y": 1856.0,
   "order_in_level": 6,
   "learning_objectives": "[\"缺必需配置时启动即失败\", \"仓库与镜像扫描不含秘密\", \"轮换模型/API 密钥无需重新编译\", \"测试环境不能访问生产资源。\"]",
   "key_concepts": "[\"A5\", \"配置、密钥与环境隔离\", \"产品后端能力\"]",
   "recommended_depth": "Use",
   "depth_rationale": "该节点是可重复使用的工程能力；学习终点是脱离逐行照抄后仍能按可靠模式完成实现。",
   "observable_evidence": "[\"缺必需配置时启动即失败\", \"仓库与镜像扫描不含秘密\", \"轮换模型/API 密钥无需重新编译\", \"测试环境不能访问生产资源。\", \"能独立完成「配置、密钥与环境隔离」的最小可运行实现，并用测试、请求或日志证明其行为\"]"
  },
  {
   "id": "053ee5cb-d56f-4bed-93a1-2406d510144d",
   "tree_id": "005d217e-2106-4a8f-ab84-769d48f52c08",
   "title": "可观测性、健康检查与故障诊断",
   "description": "回答“哪个用户请求、哪个 run、哪次模型/工具调用在哪里慢或失败”；区分存活与就绪。\n线上只能猜；日志无法关联；实例失去数据库/队列后仍接流量；故障发现晚、恢复慢。",
   "icon": "tool",
   "category": "产品后端能力",
   "difficulty": 4,
   "estimated_minutes": 120,
   "depth_level": 16,
   "position_x": 1680.0,
   "position_y": 1856.0,
   "order_in_level": 7,
   "learning_objectives": "[\"一次用户请求可沿 HTTP→DB→模型→工具完整追踪\", \"仪表盘呈现错误率、p95、队列深度\", \"依赖失效会让 readiness 失败并触发告警。\"]",
   "key_concepts": "[\"A8\", \"可观测性、健康检查与故障诊断\", \"产品后端能力\"]",
   "recommended_depth": "Transfer",
   "depth_rationale": "该节点是生产级后端的关键能力；需要在需求、流量、失败或安全约束改变时重新应用和验证。",
   "observable_evidence": "[\"一次用户请求可沿 HTTP→DB→模型→工具完整追踪\", \"仪表盘呈现错误率、p95、队列深度\", \"依赖失效会让 readiness 失败并触发告警。\", \"能在约束变化或故障注入后重新设计「可观测性、健康检查与故障诊断」，并用自动化证据验证关键性质\"]"
  },
  {
   "id": "648dfad3-4a0b-4f23-9910-5bca32dbe955",
   "tree_id": "005d217e-2106-4a8f-ab84-769d48f52c08",
   "title": "构建、Docker、CI/CD 与部署",
   "description": "学习 构建、Docker、CI/CD 与部署，建立可测试、可维护、可部署的 NestJS 后端能力。",
   "icon": "compass",
   "category": "生产工程",
   "difficulty": 5,
   "estimated_minutes": 90,
   "depth_level": 17,
   "position_x": 896.0,
   "position_y": 1972.0,
   "order_in_level": 0,
   "learning_objectives": "[\"能够用自己的话解释“构建、Docker、CI/CD 与部署”解决的问题与适用边界\", \"能够在 NestJS 后端中实现并验证“构建、Docker、CI/CD 与部署”的最小闭环\"]",
   "key_concepts": "[\"构建、Docker、CI/CD 与部署\", \"NestJS\", \"生产级后端\"]",
   "recommended_depth": "Use",
   "depth_rationale": "该节点是可重复使用的工程能力；学习终点是脱离逐行照抄后仍能按可靠模式完成实现。",
   "observable_evidence": "[\"能够用自己的话解释“构建、Docker、CI/CD 与部署”解决的问题与适用边界\", \"能够在 NestJS 后端中实现并验证“构建、Docker、CI/CD 与部署”的最小闭环\", \"能独立完成「构建、Docker、CI/CD 与部署」的最小可运行实现，并用测试、请求或日志证明其行为\"]"
  },
  {
   "id": "8ecdef36-a45e-42be-8aa8-874ce486a9cd",
   "tree_id": "005d217e-2106-4a8f-ab84-769d48f52c08",
   "title": "外部依赖可靠性：超时、退避重试、幂等与故障隔离",
   "description": "数据库、模型、支付、邮件和外部工具都会超时、限流或部分失败；请求必须有截止时间并安全重试。\n请求无限挂起；重试风暴；同一工具动作执行两次；依赖故障拖垮全部 worker。",
   "icon": "tool",
   "category": "产品后端能力",
   "difficulty": 4,
   "estimated_minutes": 120,
   "depth_level": 17,
   "position_x": 672.0,
   "position_y": 1972.0,
   "order_in_level": 1,
   "learning_objectives": "[\"注入 timeout、429、5xx、连接中断后在预算时间内结束\", \"重放相同 key 不产生重复副作用\", \"重试次数和最终原因进入指标。\"]",
   "key_concepts": "[\"A6\", \"外部依赖可靠性：超时、退避重试、幂等与故障隔离\", \"产品后端能力\"]",
   "recommended_depth": "Transfer",
   "depth_rationale": "该节点是生产级后端的关键能力；需要在需求、流量、失败或安全约束改变时重新应用和验证。",
   "observable_evidence": "[\"注入 timeout、429、5xx、连接中断后在预算时间内结束\", \"重放相同 key 不产生重复副作用\", \"重试次数和最终原因进入指标。\", \"能在约束变化或故障注入后重新设计「外部依赖可靠性：超时、退避重试、幂等与故障隔离」，并用自动化证据验证关键性质\"]"
  },
  {
   "id": "9b680e50-fb59-4719-a1fe-c0063c4fba7f",
   "tree_id": "005d217e-2106-4a8f-ab84-769d48f52c08",
   "title": "限流、配额与滥用防护",
   "description": "限制单用户、单 IP、单组织的请求、并发、工具动作和资源消耗，保护共享容量与预算。\n一个用户耗尽模型配额；暴力登录；无限循环工具调用造成成本或下游破坏。",
   "icon": "tool",
   "category": "产品后端能力",
   "difficulty": 4,
   "estimated_minutes": 120,
   "depth_level": 17,
   "position_x": 1120.0,
   "position_y": 1972.0,
   "order_in_level": 2,
   "learning_objectives": "[\"超限得到可解释 429 与重试信息\", \"用户 A 的配额不影响 B\", \"管理员可查看并冻结异常主体\", \"压力测试下系统有界退化。\"]",
   "key_concepts": "[\"A7\", \"限流、配额与滥用防护\", \"产品后端能力\"]",
   "recommended_depth": "Transfer",
   "depth_rationale": "该节点是生产级后端的关键能力；需要在需求、流量、失败或安全约束改变时重新应用和验证。",
   "observable_evidence": "[\"超限得到可解释 429 与重试信息\", \"用户 A 的配额不影响 B\", \"管理员可查看并冻结异常主体\", \"压力测试下系统有界退化。\", \"能在约束变化或故障注入后重新设计「限流、配额与滥用防护」，并用自动化证据验证关键性质\"]"
  },
  {
   "id": "458c56a8-9d3b-4d27-ae16-6770939890ba",
   "tree_id": "005d217e-2106-4a8f-ab84-769d48f52c08",
   "title": "生产级后端综合项目",
   "description": "学习 生产级后端综合项目，建立可测试、可维护、可部署的 NestJS 后端能力。",
   "icon": "compass",
   "category": "生产工程",
   "difficulty": 5,
   "estimated_minutes": 480,
   "depth_level": 18,
   "position_x": 1232.0,
   "position_y": 2088.0,
   "order_in_level": 0,
   "learning_objectives": "[\"能够用自己的话解释“生产级后端综合项目”解决的问题与适用边界\", \"能够在 NestJS 后端中实现并验证“生产级后端综合项目”的最小闭环\"]",
   "key_concepts": "[\"生产级后端综合项目\", \"NestJS\", \"生产级后端\"]",
   "recommended_depth": "Transfer",
   "depth_rationale": "该节点是生产级后端的关键能力；需要在需求、流量、失败或安全约束改变时重新应用和验证。",
   "observable_evidence": "[\"能够用自己的话解释“生产级后端综合项目”解决的问题与适用边界\", \"能够在 NestJS 后端中实现并验证“生产级后端综合项目”的最小闭环\", \"能在约束变化或故障注入后重新设计「生产级后端综合项目」，并用自动化证据验证关键性质\"]"
  },
  {
   "id": "1a2510f8-59cc-4781-ac7c-30278edbbdd4",
   "tree_id": "005d217e-2106-4a8f-ab84-769d48f52c08",
   "title": "自动化测试、供应链门禁、可重复部署与回滚",
   "description": "每次变更都能验证类型、业务规则、数据库集成、关键 E2E 和安全边界；部署失败可恢复。\n只能手工点页面；mock 掉所有真实边界；依赖投毒；线上版本不可复现、无法回滚。",
   "icon": "tool",
   "category": "产品后端能力",
   "difficulty": 4,
   "estimated_minutes": 120,
   "depth_level": 18,
   "position_x": 784.0,
   "position_y": 2088.0,
   "order_in_level": 1,
   "learning_objectives": "[\"CI 从干净环境重建并跑完整测试\", \"关键负向权限路径受 E2E 覆盖\", \"发布可追溯到 commit\", \"失败部署和数据库变更有演练过的回滚/前滚路径。\"]",
   "key_concepts": "[\"A10\", \"自动化测试、供应链门禁、可重复部署与回滚\", \"产品后端能力\"]",
   "recommended_depth": "Transfer",
   "depth_rationale": "该节点是生产级后端的关键能力；需要在需求、流量、失败或安全约束改变时重新应用和验证。",
   "observable_evidence": "[\"CI 从干净环境重建并跑完整测试\", \"关键负向权限路径受 E2E 覆盖\", \"发布可追溯到 commit\", \"失败部署和数据库变更有演练过的回滚/前滚路径。\", \"能在约束变化或故障注入后重新设计「自动化测试、供应链门禁、可重复部署与回滚」，并用自动化证据验证关键性质\"]"
  },
  {
   "id": "4da4a3b0-dc3b-473f-bb74-123792e5d36e",
   "tree_id": "005d217e-2106-4a8f-ab84-769d48f52c08",
   "title": "数据生命周期、审计、备份与恢复",
   "description": "定义会话、prompt、工具参数、上传文件、审计记录保存多久；支持导出/删除；数据库误删或损坏后恢复。\n敏感数据无限保留；无法回应删除请求或调查事故；有备份却从未验证可恢复。",
   "icon": "tool",
   "category": "产品后端能力",
   "difficulty": 4,
   "estimated_minutes": 120,
   "depth_level": 18,
   "position_x": 1008.0,
   "position_y": 2088.0,
   "order_in_level": 2,
   "learning_objectives": "[\"用户删除流程覆盖主库、对象和索引\", \"审计能回答谁在何时执行何工具\", \"从备份恢复到新环境并验证 RPO/RTO。\"]",
   "key_concepts": "[\"A9\", \"数据生命周期、审计、备份与恢复\", \"产品后端能力\"]",
   "recommended_depth": "Transfer",
   "depth_rationale": "该节点是生产级后端的关键能力；需要在需求、流量、失败或安全约束改变时重新应用和验证。",
   "observable_evidence": "[\"用户删除流程覆盖主库、对象和索引\", \"审计能回答谁在何时执行何工具\", \"从备份恢复到新环境并验证 RPO/RTO。\", \"能在约束变化或故障注入后重新设计「数据生命周期、审计、备份与恢复」，并用自动化证据验证关键性质\"]"
  },
  {
   "id": "fad625b3-ad84-4e21-a970-6d4ff0770cc8",
   "tree_id": "005d217e-2106-4a8f-ab84-769d48f52c08",
   "title": "模型网关与供应商隔离",
   "description": "在业务用例和模型 SDK 之间建立稳定接口，统一认证、模型选择、参数、错误、用量和供应商能力差异。\n供应商 SDK 渗透所有模块；模型弃用或区域故障时全局重写；无法比较模型版本的质量、成本和延迟。",
   "icon": "lightbulb",
   "category": "AI运行时必需",
   "difficulty": 4,
   "estimated_minutes": 120,
   "depth_level": 18,
   "position_x": 560.0,
   "position_y": 2088.0,
   "order_in_level": 3,
   "learning_objectives": "[\"业务服务不导入供应商 SDK\", \"fake adapter 可测试\", \"一次配置切换能做小流量模型版本对比且记录实际 model id。\"]",
   "key_concepts": "[\"B1\", \"模型网关与供应商隔离\", \"AI运行时必需\"]",
   "recommended_depth": "Understand",
   "depth_rationale": "该节点会影响架构边界或故障判断；不能只会调 API，还要能解释核心机制、边界与典型错误。",
   "observable_evidence": "[\"业务服务不导入供应商 SDK\", \"fake adapter 可测试\", \"一次配置切换能做小流量模型版本对比且记录实际 model id。\", \"能画出或口述「模型网关与供应商隔离」的关键机制，解释边界并诊断一个典型错误\"]"
  },
  {
   "id": "3276c931-cf7a-469e-a52d-9549ccf01819",
   "tree_id": "005d217e-2106-4a8f-ab84-769d48f52c08",
   "title": "生产级 Agent AI 应用后端全景",
   "description": "从 NestJS 框架根基到可运营、可治理、可扩展的 AI 应用后端。这是学习地图，不代表要在一个项目中一次学完。",
   "icon": "rocket",
   "category": "系统全景",
   "difficulty": 1,
   "estimated_minutes": 20,
   "depth_level": 0,
   "position_x": 888.5769230769232,
   "position_y": 0.0,
   "order_in_level": 0,
   "learning_objectives": "[\"识别能力分层\"]",
   "key_concepts": "[\"NestJS\", \"AI Backend\", \"Capability Map\"]",
   "recommended_depth": "Recognize",
   "depth_rationale": "该节点在当前路线中主要用于建立边界意识；现阶段应能识别它何时需要、何时可以延后。",
   "observable_evidence": "[\"识别能力分层\", \"面对需求或架构图时，能指出「生产级 Agent AI 应用后端全景」的用途、触发条件和可延后边界\"]"
  },
  {
   "id": "ff472852-abf0-4c46-97a1-23ff8fad686b",
   "tree_id": "005d217e-2106-4a8f-ab84-769d48f52c08",
   "title": "Prompt、上下文预算与结构化输出",
   "description": "可版本化地组装 system 指令、用户输入、历史、检索内容和工具结果；在上下文窗口内获得机器可校验输出。\nprompt 改动不可追溯；历史无限增长；文本解析脆弱；模型输出直接进入数据库或工具执行。",
   "icon": "lightbulb",
   "category": "AI运行时必需",
   "difficulty": 4,
   "estimated_minutes": 120,
   "depth_level": 19,
   "position_x": 1120.0,
   "position_y": 2204.0,
   "order_in_level": 0,
   "learning_objectives": "[\"每次 run 记录 prompt/config 版本但不泄露秘密\", \"超预算有确定裁剪策略\", \"无效结构无法进入业务层\", \"回归集能对比版本。\"]",
   "key_concepts": "[\"B2\", \"Prompt、上下文预算与结构化输出\", \"AI运行时必需\"]",
   "recommended_depth": "Transfer",
   "depth_rationale": "该节点是生产级后端的关键能力；需要在需求、流量、失败或安全约束改变时重新应用和验证。",
   "observable_evidence": "[\"每次 run 记录 prompt/config 版本但不泄露秘密\", \"超预算有确定裁剪策略\", \"无效结构无法进入业务层\", \"回归集能对比版本。\", \"能在约束变化或故障注入后重新设计「Prompt、上下文预算与结构化输出」，并用自动化证据验证关键性质\"]"
  },
  {
   "id": "6ef7c184-5fe7-4de6-bddf-1807d2a9afd1",
   "tree_id": "005d217e-2106-4a8f-ab84-769d48f52c08",
   "title": "流式事件协议与连接生命周期",
   "description": "把 token、工具开始/结束、阶段进度、错误和最终结果增量传给客户端；处理断线、取消、背压和最终一致状态。\n长响应像“卡死”；断线后后台继续烧钱；客户端把半截输出当成功；代理缓冲或事件丢失难排查。",
   "icon": "lightbulb",
   "category": "AI运行时必需",
   "difficulty": 4,
   "estimated_minutes": 120,
   "depth_level": 19,
   "position_x": 896.0,
   "position_y": 2204.0,
   "order_in_level": 1,
   "learning_objectives": "[\"客户端中断会取消或转后台策略\", \"事件序号单调且只有一个终态\", \"慢消费者不致内存无限增长\", \"重连后可查询最终 run。\"]",
   "key_concepts": "[\"B3\", \"流式事件协议与连接生命周期\", \"AI运行时必需\"]",
   "recommended_depth": "Transfer",
   "depth_rationale": "该节点是生产级后端的关键能力；需要在需求、流量、失败或安全约束改变时重新应用和验证。",
   "observable_evidence": "[\"客户端中断会取消或转后台策略\", \"事件序号单调且只有一个终态\", \"慢消费者不致内存无限增长\", \"重连后可查询最终 run。\", \"能在约束变化或故障注入后重新设计「流式事件协议与连接生命周期」，并用自动化证据验证关键性质\"]"
  },
  {
   "id": "e9431600-540c-4d6c-abf4-beb041d8e132",
   "tree_id": "005d217e-2106-4a8f-ab84-769d48f52c08",
   "title": "计费、订阅、权益与用量结算",
   "description": "商业产品按席位、请求、token、功能层级或额度收费。\n重复扣费；支付成功但未开权益；成本与收入脱节；客户端伪造付费状态。",
   "icon": "puzzle",
   "category": "条件能力",
   "difficulty": 4,
   "estimated_minutes": 150,
   "depth_level": 19,
   "position_x": 672.0,
   "position_y": 2204.0,
   "order_in_level": 2,
   "learning_objectives": "[\"重复/乱序 webhook 结果一致\", \"权益由服务端判断\", \"用量可对账\", \"退款/降级有确定状态转换。\"]",
   "key_concepts": "[\"C3\", \"计费、订阅、权益与用量结算\", \"条件能力\"]",
   "recommended_depth": "Transfer",
   "depth_rationale": "该节点是生产级后端的关键能力；需要在需求、流量、失败或安全约束改变时重新应用和验证。",
   "observable_evidence": "[\"重复/乱序 webhook 结果一致\", \"权益由服务端判断\", \"用量可对账\", \"退款/降级有确定状态转换。\", \"能在约束变化或故障注入后重新设计「计费、订阅、权益与用量结算」，并用自动化证据验证关键性质\"]"
  },
  {
   "id": "9396dd36-85c1-4238-a573-ebf763b6ffdd",
   "tree_id": "005d217e-2106-4a8f-ab84-769d48f52c08",
   "title": "持久化会话、Run 与工具调用状态机",
   "description": "明确 run 的 queued/running/waiting-approval/succeeded/failed/cancelled 等状态及合法转换；会话历史与执行状态可恢复。\n刷新页面丢进度；同一 run 重复执行；失败后无法判断发生到哪一步；内存中的状态随进程重启消失。",
   "icon": "lightbulb",
   "category": "AI运行时必需",
   "difficulty": 4,
   "estimated_minutes": 120,
   "depth_level": 20,
   "position_x": 896.0,
   "position_y": 2320.0,
   "order_in_level": 0,
   "learning_objectives": "[\"非法状态转换被拒\", \"进程在任意 step 崩溃后可恢复或明确失败\", \"相同 run id 不会产生两个并行执行\", \"用户可查询完整时间线。\"]",
   "key_concepts": "[\"B4\", \"持久化会话、Run 与工具调用状态机\", \"AI运行时必需\"]",
   "recommended_depth": "Transfer",
   "depth_rationale": "该节点是生产级后端的关键能力；需要在需求、流量、失败或安全约束改变时重新应用和验证。",
   "observable_evidence": "[\"非法状态转换被拒\", \"进程在任意 step 崩溃后可恢复或明确失败\", \"相同 run id 不会产生两个并行执行\", \"用户可查询完整时间线。\", \"能在约束变化或故障注入后重新设计「持久化会话、Run 与工具调用状态机」，并用自动化证据验证关键性质\"]"
  },
  {
   "id": "d7ec020b-b6b5-4fbb-a0b1-54e296e06876",
   "tree_id": "005d217e-2106-4a8f-ab84-769d48f52c08",
   "title": "异步任务、重试、死信、取消与资源控制",
   "description": "长模型调用、资料处理和工具工作不能绑定单次 HTTP 生命周期；任务需排队、限并发、续租、取消和人工重放。\n请求超时但任务仍运行；进程重启丢任务；毒任务无限重试；高峰压垮模型和数据库。",
   "icon": "lightbulb",
   "category": "AI运行时必需",
   "difficulty": 4,
   "estimated_minutes": 120,
   "depth_level": 21,
   "position_x": 784.0,
   "position_y": 2436.0,
   "order_in_level": 0,
   "learning_objectives": "[\"API 快速返回 run id\", \"杀死 worker 后任务可安全重取\", \"超过重试阈值进入 DLQ\", \"用户取消能阻止未开始步骤并停止可中断调用。\"]",
   "key_concepts": "[\"B5\", \"异步任务、重试、死信、取消与资源控制\", \"AI运行时必需\"]",
   "recommended_depth": "Transfer",
   "depth_rationale": "该节点是生产级后端的关键能力；需要在需求、流量、失败或安全约束改变时重新应用和验证。",
   "observable_evidence": "[\"API 快速返回 run id\", \"杀死 worker 后任务可安全重取\", \"超过重试阈值进入 DLQ\", \"用户取消能阻止未开始步骤并停止可中断调用。\", \"能在约束变化或故障注入后重新设计「异步任务、重试、死信、取消与资源控制」，并用自动化证据验证关键性质\"]"
  },
  {
   "id": "26c63236-ac4c-4958-88ae-f1472ec24a23",
   "tree_id": "005d217e-2106-4a8f-ab84-769d48f52c08",
   "title": "工具契约、执行隔离与确定性授权",
   "description": "工具拥有严格 schema、最小功能和最小权限；模型只“提议”调用，后端在执行前校验身份、参数、策略和资源归属。\n模型幻觉或注入导致删数据、发消息、越权读取；通用 shell/SQL 工具把模型错误放大成系统事故。",
   "icon": "lightbulb",
   "category": "AI运行时必需",
   "difficulty": 4,
   "estimated_minutes": 120,
   "depth_level": 21,
   "position_x": 1008.0,
   "position_y": 2436.0,
   "order_in_level": 1,
   "learning_objectives": "[\"未授权工具与参数在模型之外被拒\", \"凭证是用户/工具最小 scope\", \"每次调用关联 user/run/decision\", \"故障工具不会终止整个 worker。\"]",
   "key_concepts": "[\"B6\", \"工具契约、执行隔离与确定性授权\", \"AI运行时必需\"]",
   "recommended_depth": "Transfer",
   "depth_rationale": "该节点是生产级后端的关键能力；需要在需求、流量、失败或安全约束改变时重新应用和验证。",
   "observable_evidence": "[\"未授权工具与参数在模型之外被拒\", \"凭证是用户/工具最小 scope\", \"每次调用关联 user/run/decision\", \"故障工具不会终止整个 worker。\", \"能在约束变化或故障注入后重新设计「工具契约、执行隔离与确定性授权」，并用自动化证据验证关键性质\"]"
  },
  {
   "id": "fd49554d-1307-4351-8dcb-93b01e66de67",
   "tree_id": "005d217e-2106-4a8f-ab84-769d48f52c08",
   "title": "高风险动作确认、审批与补偿",
   "description": "把“读”和“写/支付/删除/发送/发布”分级；高影响动作必须展示将发生什么并由人确认；失败后可补偿或人工处置。\n模型在不确定或被操纵时直接产生不可逆副作用；用户不知道实际执行内容；重试造成重复动作。",
   "icon": "lightbulb",
   "category": "AI运行时必需",
   "difficulty": 4,
   "estimated_minutes": 120,
   "depth_level": 22,
   "position_x": 672.0,
   "position_y": 2552.0,
   "order_in_level": 0,
   "learning_objectives": "[\"危险工具在无审批时绝不执行\", \"确认页展示规范化参数\", \"审批过期或参数变化需重新确认\", \"重复确认只执行一次。\"]",
   "key_concepts": "[\"B7\", \"高风险动作确认、审批与补偿\", \"AI运行时必需\"]",
   "recommended_depth": "Transfer",
   "depth_rationale": "该节点是生产级后端的关键能力；需要在需求、流量、失败或安全约束改变时重新应用和验证。",
   "observable_evidence": "[\"危险工具在无审批时绝不执行\", \"确认页展示规范化参数\", \"审批过期或参数变化需重新确认\", \"重复确认只执行一次。\", \"能在约束变化或故障注入后重新设计「高风险动作确认、审批与补偿」，并用自动化证据验证关键性质\"]"
  },
  {
   "id": "8022a5d7-cf57-43c3-97ad-7b58cd0d837c",
   "tree_id": "005d217e-2106-4a8f-ab84-769d48f52c08",
   "title": "文件/媒体摄取与对象存储",
   "description": "用户上传文档、图片、音频或需要保存大型生成物。\n大文件压垮 API 内存；恶意文件；对象越权访问；数据库膨胀；处理状态和原文件失配。",
   "icon": "puzzle",
   "category": "条件能力",
   "difficulty": 4,
   "estimated_minutes": 150,
   "depth_level": 22,
   "position_x": 1120.0,
   "position_y": 2552.0,
   "order_in_level": 1,
   "learning_objectives": "[\"API 不代理大文件主体\", \"对象 key 不可枚举越权\", \"超限/恶意文件被拒\", \"删除和生命周期策略可验证。\"]",
   "key_concepts": "[\"C2\", \"文件/媒体摄取与对象存储\", \"条件能力\"]",
   "recommended_depth": "Use",
   "depth_rationale": "该节点是可重复使用的工程能力；学习终点是脱离逐行照抄后仍能按可靠模式完成实现。",
   "observable_evidence": "[\"API 不代理大文件主体\", \"对象 key 不可枚举越权\", \"超限/恶意文件被拒\", \"删除和生命周期策略可验证。\", \"能独立完成「文件/媒体摄取与对象存储」的最小可运行实现，并用测试、请求或日志证明其行为\"]"
  },
  {
   "id": "e3fbf1fc-e021-469a-bab7-6296461a528b",
   "tree_id": "005d217e-2106-4a8f-ab84-769d48f52c08",
   "title": "服务拆分、事件驱动、CQRS/Saga 与多团队边界",
   "description": "独立部署/扩缩容/故障隔离或团队所有权已成为可测瓶颈；模块化单体不能满足。\n消息契约、outbox、at-least-once 下的幂等、schema evolution、事件最终一致性、补偿流程。\n网络和消息新增大量失败模式；本地事务变成分布式一致性问题；运维负担上升。",
   "icon": "compass",
   "category": "规模化高级",
   "difficulty": 5,
   "estimated_minutes": 180,
   "depth_level": 22,
   "position_x": 896.0,
   "position_y": 2552.0,
   "order_in_level": 2,
   "learning_objectives": "[\"拆分理由有指标\", \"契约兼容测试\", \"重复/乱序/延迟消息测试\", \"端到端 trace\", \"故障隔离演练。\"]",
   "key_concepts": "[\"D2\", \"服务拆分、事件驱动、CQRS/Saga 与多团队边界\", \"规模化高级\"]",
   "recommended_depth": "DeepMastery",
   "depth_rationale": "该节点涉及系统级权衡与规模化演进；需要能分析底层机制、比较方案并用实验支撑重新设计。",
   "observable_evidence": "[\"拆分理由有指标\", \"契约兼容测试\", \"重复/乱序/延迟消息测试\", \"端到端 trace\", \"故障隔离演练。\", \"能为「服务拆分、事件驱动、CQRS/Saga 与多团队边界」比较至少两种方案，完成简化实现或容量/故障实验，并说明权衡\"]"
  },
  {
   "id": "38f1f5db-4545-4a94-969d-d058da472827",
   "tree_id": "005d217e-2106-4a8f-ab84-769d48f52c08",
   "title": "Prompt injection、不可信内容隔离与输出处理",
   "description": "用户输入、网页、邮件、文档和工具结果都可能携带恶意指令；模型输出也必须像外部输入一样验证后再渲染或执行。\n间接注入窃取会话/秘密、调用越权工具；模型生成 HTML/SQL/命令被盲目执行；RAG 和 fine-tuning 不能自动消除风险。",
   "icon": "lightbulb",
   "category": "AI运行时必需",
   "difficulty": 4,
   "estimated_minutes": 120,
   "depth_level": 23,
   "position_x": 896.0,
   "position_y": 2668.0,
   "order_in_level": 0,
   "learning_objectives": "[\"注入攻击集不能越过工具授权\", \"外部文本无论措辞都不能提升权限\", \"恶意输出在 sink 前被拒\", \"红队用例纳入 CI/定期评测。\"]",
   "key_concepts": "[\"B8\", \"Prompt injection、不可信内容隔离与输出处理\", \"AI运行时必需\"]",
   "recommended_depth": "Transfer",
   "depth_rationale": "该节点是生产级后端的关键能力；需要在需求、流量、失败或安全约束改变时重新应用和验证。",
   "observable_evidence": "[\"注入攻击集不能越过工具授权\", \"外部文本无论措辞都不能提升权限\", \"恶意输出在 sink 前被拒\", \"红队用例纳入 CI/定期评测。\", \"能在约束变化或故障注入后重新设计「Prompt injection、不可信内容隔离与输出处理」，并用自动化证据验证关键性质\"]"
  },
  {
   "id": "9f6a8605-5e00-4b89-99ea-0ef566f4d1ae",
   "tree_id": "005d217e-2106-4a8f-ab84-769d48f52c08",
   "title": "AI 评测、回归门禁与线上反馈闭环",
   "description": "模型是非确定依赖，普通单元测试不足以证明正确性；prompt/model/tool 变化需在代表性任务集上比较质量与安全。\n模型升级悄悄降低任务成功率；只凭几个 demo 判断；安全回归直到用户事故才被发现。",
   "icon": "lightbulb",
   "category": "AI运行时必需",
   "difficulty": 4,
   "estimated_minutes": 120,
   "depth_level": 24,
   "position_x": 896.0,
   "position_y": 2784.0,
   "order_in_level": 0,
   "learning_objectives": "[\"每次 prompt/model 变更生成质量、安全、延迟和成本报告\", \"关键阈值阻止发布\", \"线上失败可回放为新回归样本。\"]",
   "key_concepts": "[\"B10\", \"AI 评测、回归门禁与线上反馈闭环\", \"AI运行时必需\"]",
   "recommended_depth": "Transfer",
   "depth_rationale": "该节点是生产级后端的关键能力；需要在需求、流量、失败或安全约束改变时重新应用和验证。",
   "observable_evidence": "[\"每次 prompt/model 变更生成质量、安全、延迟和成本报告\", \"关键阈值阻止发布\", \"线上失败可回放为新回归样本。\", \"能在约束变化或故障注入后重新设计「AI 评测、回归门禁与线上反馈闭环」，并用自动化证据验证关键性质\"]"
  },
  {
   "id": "feec11df-1cea-4555-9f42-e609ee04458b",
   "tree_id": "005d217e-2106-4a8f-ab84-769d48f52c08",
   "title": "内容安全、隐私与数据最小化",
   "description": "按产品政策处理伤害性内容、PII/秘密、未成年人或高风险领域；只把完成任务所需数据发送给模型和工具。\n敏感数据泄露给模型供应商、日志或其他用户；不合规输出；安全策略只写在 system prompt 中而可绕过。",
   "icon": "lightbulb",
   "category": "AI运行时必需",
   "difficulty": 4,
   "estimated_minutes": 120,
   "depth_level": 24,
   "position_x": 1120.0,
   "position_y": 2784.0,
   "order_in_level": 1,
   "learning_objectives": "[\"明确测试集覆盖允许/拒绝/升级人工\", \"敏感字段不进入 prompt/trace\", \"用户可获知数据用途\", \"策略决策可审计且有误杀处理。\"]",
   "key_concepts": "[\"B9\", \"内容安全、隐私与数据最小化\", \"AI运行时必需\"]",
   "recommended_depth": "Understand",
   "depth_rationale": "该节点会影响架构边界或故障判断；不能只会调 API，还要能解释核心机制、边界与典型错误。",
   "observable_evidence": "[\"明确测试集覆盖允许/拒绝/升级人工\", \"敏感字段不进入 prompt/trace\", \"用户可获知数据用途\", \"策略决策可审计且有误杀处理。\", \"能画出或口述「内容安全、隐私与数据最小化」的关键机制，解释边界并诊断一个典型错误\"]"
  },
  {
   "id": "3561dfc1-d964-432b-b753-6fd96e808bb8",
   "tree_id": "005d217e-2106-4a8f-ab84-769d48f52c08",
   "title": "代码、浏览器与远程工具沙箱",
   "description": "Agent 要执行不可信代码、访问网页、文件系统或用户网络资源。\n远程代码执行、SSRF、凭证/文件窃取、持久化恶意进程、资源耗尽。",
   "icon": "puzzle",
   "category": "条件能力",
   "difficulty": 4,
   "estimated_minutes": 150,
   "depth_level": 24,
   "position_x": 672.0,
   "position_y": 2784.0,
   "order_in_level": 2,
   "learning_objectives": "[\"逃逸、内网探测、fork bomb、超时和秘密读取测试被阻止\", \"环境任务后销毁\", \"完整审计记录不含秘密。\"]",
   "key_concepts": "[\"C6\", \"代码、浏览器与远程工具沙箱\", \"条件能力\"]",
   "recommended_depth": "Transfer",
   "depth_rationale": "该节点是生产级后端的关键能力；需要在需求、流量、失败或安全约束改变时重新应用和验证。",
   "observable_evidence": "[\"逃逸、内网探测、fork bomb、超时和秘密读取测试被阻止\", \"环境任务后销毁\", \"完整审计记录不含秘密。\", \"能在约束变化或故障注入后重新设计「代码、浏览器与远程工具沙箱」，并用自动化证据验证关键性质\"]"
  },
  {
   "id": "2e7f9afc-51c4-499b-9c7e-da6b95991f04",
   "tree_id": "005d217e-2106-4a8f-ab84-769d48f52c08",
   "title": "Token、成本、延迟与 AI 专属追踪",
   "description": "按用户/run/model/工具记录 token、请求数、延迟、重试和成本；定位慢在模型、检索、队列还是工具。\n账单暴涨才发现循环；无法设置预算或解释用户体验；通用 HTTP 日志看不见 Agent 内部步骤。",
   "icon": "lightbulb",
   "category": "AI运行时必需",
   "difficulty": 4,
   "estimated_minutes": 120,
   "depth_level": 25,
   "position_x": 1008.0,
   "position_y": 2900.0,
   "order_in_level": 0,
   "learning_objectives": "[\"一个 run 的供应商用量与内部账本可对账\", \"达到预算立即停止或降级\", \"trace 展示每步耗时和 token\", \"无 prompt 明文泄露。\"]",
   "key_concepts": "[\"B11\", \"Token、成本、延迟与 AI 专属追踪\", \"AI运行时必需\"]",
   "recommended_depth": "Transfer",
   "depth_rationale": "该节点是生产级后端的关键能力；需要在需求、流量、失败或安全约束改变时重新应用和验证。",
   "observable_evidence": "[\"一个 run 的供应商用量与内部账本可对账\", \"达到预算立即停止或降级\", \"trace 展示每步耗时和 token\", \"无 prompt 明文泄露。\", \"能在约束变化或故障注入后重新设计「Token、成本、延迟与 AI 专属追踪」，并用自动化证据验证关键性质\"]"
  },
  {
   "id": "3733cc5d-2799-4840-8695-7caedb44689c",
   "tree_id": "005d217e-2106-4a8f-ab84-769d48f52c08",
   "title": "RAG：摄取、检索、权限过滤、出处与删除传播",
   "description": "产品承诺回答私有/动态知识，而不是只依赖模型已有知识。\n过时或跨用户文档被检索；答案无出处；原文删除后向量仍可被召回；检索内容携带间接注入。",
   "icon": "puzzle",
   "category": "条件能力",
   "difficulty": 4,
   "estimated_minutes": 150,
   "depth_level": 25,
   "position_x": 784.0,
   "position_y": 2900.0,
   "order_in_level": 1,
   "learning_objectives": "[\"用户 A 永不检索 B 的文档\", \"答案可追到 chunk/版本\", \"删除会传播到对象、元数据和索引\", \"检索质量有离线集合。\"]",
   "key_concepts": "[\"C1\", \"RAG：摄取、检索、权限过滤、出处与删除传播\", \"条件能力\"]",
   "recommended_depth": "Transfer",
   "depth_rationale": "该节点是生产级后端的关键能力；需要在需求、流量、失败或安全约束改变时重新应用和验证。",
   "observable_evidence": "[\"用户 A 永不检索 B 的文档\", \"答案可追到 chunk/版本\", \"删除会传播到对象、元数据和索引\", \"检索质量有离线集合。\", \"能在约束变化或故障注入后重新设计「RAG：摄取、检索、权限过滤、出处与删除传播」，并用自动化证据验证关键性质\"]"
  },
  {
   "id": "8c205814-b523-429b-b297-f636abd44f06",
   "tree_id": "005d217e-2106-4a8f-ab84-769d48f52c08",
   "title": "实时语音、双向交互或多人协作",
   "description": "产品需要低延迟语音、打断、双向事件或共享房间；普通文字流式不需要。\n连接状态与业务状态混淆；重连重复事件；音频成本无界；水平扩展后房间状态丢失。",
   "icon": "puzzle",
   "category": "条件能力",
   "difficulty": 4,
   "estimated_minutes": 150,
   "depth_level": 26,
   "position_x": 1232.0,
   "position_y": 3016.0,
   "order_in_level": 0,
   "learning_objectives": "[\"重连、乱序、打断和多端登录测试通过\", \"连接断开不破坏持久 run\", \"延迟与每分钟成本可观察。\"]",
   "key_concepts": "[\"C4\", \"实时语音、双向交互或多人协作\", \"条件能力\"]",
   "recommended_depth": "Transfer",
   "depth_rationale": "该节点是生产级后端的关键能力；需要在需求、流量、失败或安全约束改变时重新应用和验证。",
   "observable_evidence": "[\"重连、乱序、打断和多端登录测试通过\", \"连接断开不破坏持久 run\", \"延迟与每分钟成本可观察。\", \"能在约束变化或故障注入后重新设计「实时语音、双向交互或多人协作」，并用自动化证据验证关键性质\"]"
  },
  {
   "id": "0abf4fff-3741-40f6-87c9-c3b49fa95130",
   "tree_id": "005d217e-2106-4a8f-ab84-769d48f52c08",
   "title": "多 Agent 编排",
   "description": "单 Agent 因工具过载、不同安全边界或真正可并行的专门任务无法可靠满足需求；“更酷”不是理由。\n协调、延迟、成本和失败面成倍增加；Agent 互相传递不可信内容；责任与权限边界模糊。",
   "icon": "puzzle",
   "category": "条件能力",
   "difficulty": 4,
   "estimated_minutes": 150,
   "depth_level": 26,
   "position_x": 560.0,
   "position_y": 3016.0,
   "order_in_level": 1,
   "learning_objectives": "[\"基准证明优于单 Agent\", \"任一步可独立重试/超时\", \"循环受最大步数限制\", \"handoff 有 schema 和身份/权限上下文。\"]",
   "key_concepts": "[\"C5\", \"多 Agent 编排\", \"条件能力\"]",
   "recommended_depth": "Recognize",
   "depth_rationale": "该节点在当前路线中主要用于建立边界意识；现阶段应能识别它何时需要、何时可以延后。",
   "observable_evidence": "[\"基准证明优于单 Agent\", \"任一步可独立重试/超时\", \"循环受最大步数限制\", \"handoff 有 schema 和身份/权限上下文。\", \"面对需求或架构图时，能指出「多 Agent 编排」的用途、触发条件和可延后边界\"]"
  },
  {
   "id": "0307ea0f-0779-4355-a4e7-b9f9d40e111a",
   "tree_id": "005d217e-2106-4a8f-ab84-769d48f52c08",
   "title": "缓存、批处理、动态路由与容量工程",
   "description": "已有流量、延迟和成本基线显示重复工作或供应商容量成为瓶颈。\n语义/普通缓存的安全 key 与失效；prompt caching；批处理；模型按任务路由；load test 和容量模型。\n缓存跨用户泄漏或过期答案；路由降低质量；优化复杂度超过收益。",
   "icon": "compass",
   "category": "规模化高级",
   "difficulty": 5,
   "estimated_minutes": 180,
   "depth_level": 26,
   "position_x": 784.0,
   "position_y": 3016.0,
   "order_in_level": 2,
   "learning_objectives": "[\"真实基准显示 SLO/成本改善\", \"缓存包含 tenant/权限/版本维度\", \"质量 eval 证明路由不退化。\"]",
   "key_concepts": "[\"D1\", \"缓存、批处理、动态路由与容量工程\", \"规模化高级\"]",
   "recommended_depth": "DeepMastery",
   "depth_rationale": "该节点涉及系统级权衡与规模化演进；需要能分析底层机制、比较方案并用实验支撑重新设计。",
   "observable_evidence": "[\"真实基准显示 SLO/成本改善\", \"缓存包含 tenant/权限/版本维度\", \"质量 eval 证明路由不退化。\", \"能为「缓存、批处理、动态路由与容量工程」比较至少两种方案，完成简化实现或容量/故障实验，并说明权衡\"]"
  },
  {
   "id": "9d0f563b-a0c7-4d49-bc5d-a61d238c3a8e",
   "tree_id": "005d217e-2106-4a8f-ab84-769d48f52c08",
   "title": "多实例/多区域高可用、灾难恢复与合规隔离",
   "description": "明确 SLO、RTO/RPO、地域/数据驻留、峰值容量或企业合规要求。\n无状态水平扩展、分区/副本、跨区故障转移、流量切换、灾难恢复、降级模式、混沌/恢复演练。\n跨区域数据一致性与成本激增；未经演练的“高可用”只是架构图。",
   "icon": "compass",
   "category": "规模化高级",
   "difficulty": 5,
   "estimated_minutes": 180,
   "depth_level": 26,
   "position_x": 1008.0,
   "position_y": 3016.0,
   "order_in_level": 3,
   "learning_objectives": "[\"容量与故障注入验证 SLO\", \"区域故障演练在 RTO 内恢复\", \"备份满足 RPO\", \"依赖不可用时有明确降级。\"]",
   "key_concepts": "[\"D3\", \"多实例/多区域高可用、灾难恢复与合规隔离\", \"规模化高级\"]",
   "recommended_depth": "DeepMastery",
   "depth_rationale": "该节点涉及系统级权衡与规模化演进；需要能分析底层机制、比较方案并用实验支撑重新设计。",
   "observable_evidence": "[\"容量与故障注入验证 SLO\", \"区域故障演练在 RTO 内恢复\", \"备份满足 RPO\", \"依赖不可用时有明确降级。\", \"能为「多实例/多区域高可用、灾难恢复与合规隔离」比较至少两种方案，完成简化实现或容量/故障实验，并说明权衡\"]"
  }
 ],
 "edges": [
  {
   "id": "27112e4e-5ac5-474d-855a-fc296ac22e3a",
   "source_node_id": "733f0ac2-5a0d-409a-aaf6-980c6180448c",
   "target_node_id": "a489a8a5-60b0-421d-b961-d2c333c89d48",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "d328ad52-bcd0-4fc8-8318-4018da20dfb2",
   "source_node_id": "733f0ac2-5a0d-409a-aaf6-980c6180448c",
   "target_node_id": "553f1af2-7c28-43e3-9fe5-c1b2b5af93b7",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "0bce21e2-5c06-46c5-9f63-c60d7c014daf",
   "source_node_id": "a489a8a5-60b0-421d-b961-d2c333c89d48",
   "target_node_id": "fc501705-d7b5-4a72-bbd6-a17d31862450",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "7985ca25-69f3-4fb2-8a5a-c0b742a84e72",
   "source_node_id": "a489a8a5-60b0-421d-b961-d2c333c89d48",
   "target_node_id": "7305a41d-1a7f-4cbe-aab0-db66e48f7a73",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "875422cc-6eec-4a08-aa68-9843cbcac54e",
   "source_node_id": "fc501705-d7b5-4a72-bbd6-a17d31862450",
   "target_node_id": "7305a41d-1a7f-4cbe-aab0-db66e48f7a73",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "04bfbda8-8b53-44d5-aa69-e66925b212da",
   "source_node_id": "fc501705-d7b5-4a72-bbd6-a17d31862450",
   "target_node_id": "c6e9be5e-ba1d-4d07-aeb1-92de85a1c58e",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "de06ece3-c940-40b0-807b-68dd3decc427",
   "source_node_id": "fc501705-d7b5-4a72-bbd6-a17d31862450",
   "target_node_id": "a017d8e0-924a-4c3d-938f-8c9ebdca6f92",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "94e18351-c430-4777-8501-3f6add5d4740",
   "source_node_id": "7305a41d-1a7f-4cbe-aab0-db66e48f7a73",
   "target_node_id": "b8c696d2-eb90-4462-a67c-46cb5e9271fd",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "9e142289-d848-4761-8fdb-4d3fb6e82a6a",
   "source_node_id": "7305a41d-1a7f-4cbe-aab0-db66e48f7a73",
   "target_node_id": "bd92e618-db3f-486d-8668-cdca815c0af3",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "48367556-3593-4f02-890a-20d6b41bbc59",
   "source_node_id": "7305a41d-1a7f-4cbe-aab0-db66e48f7a73",
   "target_node_id": "b9af692b-da07-40e5-a7fd-ab13d5af4838",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "7b2d72a3-b4e4-4c38-b60f-af991c946fbb",
   "source_node_id": "7305a41d-1a7f-4cbe-aab0-db66e48f7a73",
   "target_node_id": "c5dd4d67-9089-409c-a38a-11a55d79ec51",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "f6d9e236-7d44-46da-9cb8-87efa8c7ed9b",
   "source_node_id": "b8c696d2-eb90-4462-a67c-46cb5e9271fd",
   "target_node_id": "bd92e618-db3f-486d-8668-cdca815c0af3",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "3c1d4ad4-ae52-4682-b431-c93424f9704f",
   "source_node_id": "b8c696d2-eb90-4462-a67c-46cb5e9271fd",
   "target_node_id": "d3f2ac22-57b5-4643-a647-9f1a5f0a36ba",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "f4d3cef0-91fa-483f-89e3-fcd70dca1c74",
   "source_node_id": "b8c696d2-eb90-4462-a67c-46cb5e9271fd",
   "target_node_id": "b9af692b-da07-40e5-a7fd-ab13d5af4838",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "3c7dbcec-582d-4b09-900a-b8883666a5bf",
   "source_node_id": "b8c696d2-eb90-4462-a67c-46cb5e9271fd",
   "target_node_id": "9f3c356a-05a8-4bdf-90e4-d260721451cf",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "a263cd40-6fb3-4e41-8f1e-cfc689731a39",
   "source_node_id": "b8c696d2-eb90-4462-a67c-46cb5e9271fd",
   "target_node_id": "056e06aa-8631-4e9b-877a-fb190a3c6323",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "10281735-72e2-475f-8f8e-13a0e11be34b",
   "source_node_id": "b8c696d2-eb90-4462-a67c-46cb5e9271fd",
   "target_node_id": "f3200ee6-d3ab-4849-bbcb-ed6954c65b0f",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "237a5f42-b028-434e-a9b1-574b7ec3b8d7",
   "source_node_id": "bd92e618-db3f-486d-8668-cdca815c0af3",
   "target_node_id": "d3f2ac22-57b5-4643-a647-9f1a5f0a36ba",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "e68dbf2c-f67c-4fb2-9a28-de92e67002c8",
   "source_node_id": "bd92e618-db3f-486d-8668-cdca815c0af3",
   "target_node_id": "2a639942-cba2-4931-b3a1-d6e5734621a2",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "de566fdc-1a01-4cb6-a4fc-703efb1db601",
   "source_node_id": "bd92e618-db3f-486d-8668-cdca815c0af3",
   "target_node_id": "3253d579-f0b7-4d31-b524-6070775a37a1",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "d16bd302-d9c2-416e-8989-f2a78e8f9885",
   "source_node_id": "d3f2ac22-57b5-4643-a647-9f1a5f0a36ba",
   "target_node_id": "2a639942-cba2-4931-b3a1-d6e5734621a2",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "ec8d2e5c-908e-4a60-a517-87ce7b540442",
   "source_node_id": "d3f2ac22-57b5-4643-a647-9f1a5f0a36ba",
   "target_node_id": "9f3c356a-05a8-4bdf-90e4-d260721451cf",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "8c3e2afd-e38d-46ec-8aca-795e170dceb9",
   "source_node_id": "d3f2ac22-57b5-4643-a647-9f1a5f0a36ba",
   "target_node_id": "056e06aa-8631-4e9b-877a-fb190a3c6323",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "774643d4-5831-4f04-89d2-7f293a90a755",
   "source_node_id": "d3f2ac22-57b5-4643-a647-9f1a5f0a36ba",
   "target_node_id": "ebb592f5-81e0-403f-8922-a0edbb258d1c",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "cb82e408-0e72-4f3f-9b29-e3f23a885a60",
   "source_node_id": "d3f2ac22-57b5-4643-a647-9f1a5f0a36ba",
   "target_node_id": "c5dd4d67-9089-409c-a38a-11a55d79ec51",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "5d43c2ca-1124-4215-a9ad-2b44706e51ea",
   "source_node_id": "2a639942-cba2-4931-b3a1-d6e5734621a2",
   "target_node_id": "dd6fcc43-af99-44ac-b3c9-d389e101ff61",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "93243e37-d685-416b-9c1e-06828330f476",
   "source_node_id": "2a639942-cba2-4931-b3a1-d6e5734621a2",
   "target_node_id": "c6e9be5e-ba1d-4d07-aeb1-92de85a1c58e",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "d69a8537-4676-430b-9982-22718bb893fa",
   "source_node_id": "2a639942-cba2-4931-b3a1-d6e5734621a2",
   "target_node_id": "0acc2273-60b8-4d70-b3c2-7d6d66f78385",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "399484f2-371e-4356-9f67-81c28739f018",
   "source_node_id": "2a639942-cba2-4931-b3a1-d6e5734621a2",
   "target_node_id": "bc4df4b4-7cdf-41dd-8d3e-656bd47df8b4",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "fe5f3cad-2786-4638-9cf9-9985696b85ca",
   "source_node_id": "2a639942-cba2-4931-b3a1-d6e5734621a2",
   "target_node_id": "5e96d7a5-4c15-48b7-83a6-cc4075df5f34",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "dd881e1c-4048-44da-aea7-8768faf4bfb9",
   "source_node_id": "dd6fcc43-af99-44ac-b3c9-d389e101ff61",
   "target_node_id": "18c48cfa-7b5c-4020-9c2c-b77e79a7dbef",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "d0f78ba6-479d-4a7b-9744-8bc92262e448",
   "source_node_id": "c6e9be5e-ba1d-4d07-aeb1-92de85a1c58e",
   "target_node_id": "0acc2273-60b8-4d70-b3c2-7d6d66f78385",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "6c30eb64-6193-4d59-83d2-635a5c2d842f",
   "source_node_id": "c6e9be5e-ba1d-4d07-aeb1-92de85a1c58e",
   "target_node_id": "3253d579-f0b7-4d31-b524-6070775a37a1",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "ea704ea7-6ccb-401d-b578-89ad7d0616d7",
   "source_node_id": "c6e9be5e-ba1d-4d07-aeb1-92de85a1c58e",
   "target_node_id": "b3d38af8-4dbf-4d07-a3bc-96b5992895c0",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "66fd39ba-ebb9-4cf2-b570-a485f757a62e",
   "source_node_id": "c6e9be5e-ba1d-4d07-aeb1-92de85a1c58e",
   "target_node_id": "bb3cffe2-8924-4584-ba84-a890a09d8c35",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "e8417ae7-2fcf-469e-ae91-79cfbab4667c",
   "source_node_id": "c6e9be5e-ba1d-4d07-aeb1-92de85a1c58e",
   "target_node_id": "056e06aa-8631-4e9b-877a-fb190a3c6323",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "c789c532-167a-430d-82c8-723f2c877dfb",
   "source_node_id": "c6e9be5e-ba1d-4d07-aeb1-92de85a1c58e",
   "target_node_id": "f61865b8-07cf-4ead-8e0a-c14ab61aaee3",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "38a0ff54-7c47-42da-8ee3-5708539cb1ce",
   "source_node_id": "0acc2273-60b8-4d70-b3c2-7d6d66f78385",
   "target_node_id": "5e96d7a5-4c15-48b7-83a6-cc4075df5f34",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "26a13253-f831-4789-a1a1-e17b22e92268",
   "source_node_id": "0acc2273-60b8-4d70-b3c2-7d6d66f78385",
   "target_node_id": "3253d579-f0b7-4d31-b524-6070775a37a1",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "d00e7af6-5433-419b-8530-f714dacced00",
   "source_node_id": "0acc2273-60b8-4d70-b3c2-7d6d66f78385",
   "target_node_id": "901ccee3-3493-4256-bd1e-92a752ec7501",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "7be8455c-f032-4f26-a481-4b28500649da",
   "source_node_id": "0acc2273-60b8-4d70-b3c2-7d6d66f78385",
   "target_node_id": "18c48cfa-7b5c-4020-9c2c-b77e79a7dbef",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "a8cfec7e-5385-4fc9-88bc-75ac0402085f",
   "source_node_id": "bc4df4b4-7cdf-41dd-8d3e-656bd47df8b4",
   "target_node_id": "a017d8e0-924a-4c3d-938f-8c9ebdca6f92",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "e3464d78-725c-4eca-89a6-d2def6b2a3b5",
   "source_node_id": "bc4df4b4-7cdf-41dd-8d3e-656bd47df8b4",
   "target_node_id": "366f9417-f6dd-475e-a3dc-1321a8ca5615",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "ab2c7a51-62e8-4e58-b878-bf7690ecba12",
   "source_node_id": "bc4df4b4-7cdf-41dd-8d3e-656bd47df8b4",
   "target_node_id": "af38e816-d01a-4549-964d-e86377211ca9",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "942c1cf8-d985-4493-8c33-ad580eba00b3",
   "source_node_id": "bc4df4b4-7cdf-41dd-8d3e-656bd47df8b4",
   "target_node_id": "fe35e499-b99d-4a81-9698-041f75a32c8a",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "ba3dedff-9a58-479c-8ba7-0cbad2b288ec",
   "source_node_id": "bc4df4b4-7cdf-41dd-8d3e-656bd47df8b4",
   "target_node_id": "056e06aa-8631-4e9b-877a-fb190a3c6323",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "7808f416-65d0-4ca0-bfb7-bf7d21f98010",
   "source_node_id": "5e96d7a5-4c15-48b7-83a6-cc4075df5f34",
   "target_node_id": "a017d8e0-924a-4c3d-938f-8c9ebdca6f92",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "3f73b645-36c4-42c5-97c0-eaffa371a63e",
   "source_node_id": "5e96d7a5-4c15-48b7-83a6-cc4075df5f34",
   "target_node_id": "bb3cffe2-8924-4584-ba84-a890a09d8c35",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "a0451e2f-81a1-4be9-b54c-6936a81a4f87",
   "source_node_id": "5e96d7a5-4c15-48b7-83a6-cc4075df5f34",
   "target_node_id": "56d55022-f1f4-4b49-8afc-e27ca2dad6e9",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "40173cc4-b889-4ae4-a541-9d5420c03e67",
   "source_node_id": "5e96d7a5-4c15-48b7-83a6-cc4075df5f34",
   "target_node_id": "901ccee3-3493-4256-bd1e-92a752ec7501",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "6c565bd5-b0d9-4845-972f-32c2005e8477",
   "source_node_id": "a017d8e0-924a-4c3d-938f-8c9ebdca6f92",
   "target_node_id": "af38e816-d01a-4549-964d-e86377211ca9",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "e3e59c54-29e4-4b5d-ad58-b6e4b05216bb",
   "source_node_id": "a017d8e0-924a-4c3d-938f-8c9ebdca6f92",
   "target_node_id": "f3200ee6-d3ab-4849-bbcb-ed6954c65b0f",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "7d36aaca-46da-480c-aae8-d1be94750f75",
   "source_node_id": "a017d8e0-924a-4c3d-938f-8c9ebdca6f92",
   "target_node_id": "3d8dbd34-0ee1-4e4c-aceb-1225d3247110",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "c673feb6-5e8e-4f86-9678-19d626929ebb",
   "source_node_id": "a017d8e0-924a-4c3d-938f-8c9ebdca6f92",
   "target_node_id": "3a63d4b5-15fc-4fc4-b6f7-deacabb8828a",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "04e2aff9-9c66-4ee1-ba42-9cc5a4f27595",
   "source_node_id": "a017d8e0-924a-4c3d-938f-8c9ebdca6f92",
   "target_node_id": "f61865b8-07cf-4ead-8e0a-c14ab61aaee3",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "d2e91993-51a7-49dd-8555-72e9e534269a",
   "source_node_id": "b9af692b-da07-40e5-a7fd-ab13d5af4838",
   "target_node_id": "366f9417-f6dd-475e-a3dc-1321a8ca5615",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "6f730c80-0411-42e6-8f73-6c71b859ccfa",
   "source_node_id": "b9af692b-da07-40e5-a7fd-ab13d5af4838",
   "target_node_id": "ba297c75-e891-4042-a6d9-a3e9eefa3b1a",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "c6adcbd8-181e-4dc1-878b-67cb0337e2c5",
   "source_node_id": "b9af692b-da07-40e5-a7fd-ab13d5af4838",
   "target_node_id": "ebb592f5-81e0-403f-8922-a0edbb258d1c",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "6b85c5cb-8d1e-4578-99a6-cd6766875f79",
   "source_node_id": "b9af692b-da07-40e5-a7fd-ab13d5af4838",
   "target_node_id": "901ccee3-3493-4256-bd1e-92a752ec7501",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "c24e3860-6012-424f-85d5-0c97ec0e605d",
   "source_node_id": "b9af692b-da07-40e5-a7fd-ab13d5af4838",
   "target_node_id": "18c48cfa-7b5c-4020-9c2c-b77e79a7dbef",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "7e190f7c-1f0a-48a1-8573-5cc220943210",
   "source_node_id": "b9af692b-da07-40e5-a7fd-ab13d5af4838",
   "target_node_id": "9aa1dd2e-93e2-4304-af99-eca50c382775",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "83b21bb4-0f78-4c1c-abeb-06a59bc8c688",
   "source_node_id": "3253d579-f0b7-4d31-b524-6070775a37a1",
   "target_node_id": "b3d38af8-4dbf-4d07-a3bc-96b5992895c0",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "5bdc592d-f496-4a7f-bbea-0b08370d33c5",
   "source_node_id": "3253d579-f0b7-4d31-b524-6070775a37a1",
   "target_node_id": "ced48831-6fff-409a-8ed9-4389d6bb13b0",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "20d9a858-e423-4e25-87b4-5b587154ec1b",
   "source_node_id": "b3d38af8-4dbf-4d07-a3bc-96b5992895c0",
   "target_node_id": "7f6cc719-2108-4f50-83b7-6e80840830fd",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "65d3ee0d-c23f-4dca-932c-536991c7d54b",
   "source_node_id": "b3d38af8-4dbf-4d07-a3bc-96b5992895c0",
   "target_node_id": "458c56a8-9d3b-4d27-ae16-6770939890ba",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "eea7de30-8a0b-445c-8e2c-97ff598800eb",
   "source_node_id": "553f1af2-7c28-43e3-9fe5-c1b2b5af93b7",
   "target_node_id": "9f3c356a-05a8-4bdf-90e4-d260721451cf",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "e7f9d4d2-f3e3-428d-b2a8-5b01773bbf79",
   "source_node_id": "553f1af2-7c28-43e3-9fe5-c1b2b5af93b7",
   "target_node_id": "ced48831-6fff-409a-8ed9-4389d6bb13b0",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "8d67b93d-28ea-4bef-bbf3-99554813e2a0",
   "source_node_id": "9f3c356a-05a8-4bdf-90e4-d260721451cf",
   "target_node_id": "0194790d-0689-4665-a4fb-b882e33e5a87",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "fcfa5f63-7c92-44c1-9e00-ac27a1f17458",
   "source_node_id": "9f3c356a-05a8-4bdf-90e4-d260721451cf",
   "target_node_id": "ced48831-6fff-409a-8ed9-4389d6bb13b0",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "b54574ce-06a6-4001-b47d-37610a11c22f",
   "source_node_id": "9f3c356a-05a8-4bdf-90e4-d260721451cf",
   "target_node_id": "bb3cffe2-8924-4584-ba84-a890a09d8c35",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "363288e8-3d28-4ff9-947a-ec4bf8868a3b",
   "source_node_id": "9f3c356a-05a8-4bdf-90e4-d260721451cf",
   "target_node_id": "366f9417-f6dd-475e-a3dc-1321a8ca5615",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "e1e08da0-464e-4b20-b1f6-f37ae5aa196f",
   "source_node_id": "9f3c356a-05a8-4bdf-90e4-d260721451cf",
   "target_node_id": "640b80be-c1b8-4575-a1e3-e265a58e2a97",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "273941f8-177b-411b-894f-1a2b7b5766b3",
   "source_node_id": "9f3c356a-05a8-4bdf-90e4-d260721451cf",
   "target_node_id": "56d55022-f1f4-4b49-8afc-e27ca2dad6e9",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "e9ac0d1e-7427-4605-b5e0-c25c690e0503",
   "source_node_id": "9f3c356a-05a8-4bdf-90e4-d260721451cf",
   "target_node_id": "c5dd4d67-9089-409c-a38a-11a55d79ec51",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "ec7b0282-50ac-4024-ad4c-dfc3088c3c94",
   "source_node_id": "9f3c356a-05a8-4bdf-90e4-d260721451cf",
   "target_node_id": "f61865b8-07cf-4ead-8e0a-c14ab61aaee3",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "045c42ab-f1ce-4913-946c-00065197d21e",
   "source_node_id": "0194790d-0689-4665-a4fb-b882e33e5a87",
   "target_node_id": "ced48831-6fff-409a-8ed9-4389d6bb13b0",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "adb53724-ef68-4c7a-9fa8-ba9c18ec1db5",
   "source_node_id": "0194790d-0689-4665-a4fb-b882e33e5a87",
   "target_node_id": "640b80be-c1b8-4575-a1e3-e265a58e2a97",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "76d1a568-26d2-43d0-8979-c6d0cd906c70",
   "source_node_id": "0194790d-0689-4665-a4fb-b882e33e5a87",
   "target_node_id": "648dfad3-4a0b-4f23-9910-5bca32dbe955",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "03bc50fe-83e0-4192-9588-9d216d5be2b2",
   "source_node_id": "ced48831-6fff-409a-8ed9-4389d6bb13b0",
   "target_node_id": "d3136c72-f4c8-453a-9aae-c65747c1265e",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "5dd9d5ae-b1ed-4e3f-b462-698d2e30baef",
   "source_node_id": "ced48831-6fff-409a-8ed9-4389d6bb13b0",
   "target_node_id": "640b80be-c1b8-4575-a1e3-e265a58e2a97",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "6f9bb1fd-7058-4282-ae60-cb6b34759c8f",
   "source_node_id": "ced48831-6fff-409a-8ed9-4389d6bb13b0",
   "target_node_id": "ebb592f5-81e0-403f-8922-a0edbb258d1c",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "a2ed7fb5-b70e-4f3c-8f56-72f9489b68cd",
   "source_node_id": "ced48831-6fff-409a-8ed9-4389d6bb13b0",
   "target_node_id": "56d55022-f1f4-4b49-8afc-e27ca2dad6e9",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "7174d5e2-5716-4142-b958-4adf8010c57a",
   "source_node_id": "ced48831-6fff-409a-8ed9-4389d6bb13b0",
   "target_node_id": "f5232c8c-c342-44d3-a56c-1926c7ac0ff8",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "730f8f06-a1d9-4eb8-8567-6dae7f9d27e2",
   "source_node_id": "ced48831-6fff-409a-8ed9-4389d6bb13b0",
   "target_node_id": "172a8c43-e1eb-406b-941d-9b3a28cfe470",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "349de341-b5fb-4d8c-baa7-2ed9d68fb961",
   "source_node_id": "bb3cffe2-8924-4584-ba84-a890a09d8c35",
   "target_node_id": "366f9417-f6dd-475e-a3dc-1321a8ca5615",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "2dc05d93-bd19-4822-a01d-d3406a58686f",
   "source_node_id": "366f9417-f6dd-475e-a3dc-1321a8ca5615",
   "target_node_id": "d3136c72-f4c8-453a-9aae-c65747c1265e",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "230979de-134d-436c-92a2-8e674ed0e03e",
   "source_node_id": "366f9417-f6dd-475e-a3dc-1321a8ca5615",
   "target_node_id": "af38e816-d01a-4549-964d-e86377211ca9",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "48c52252-64c5-43c1-ad5f-d26d493e9d3f",
   "source_node_id": "366f9417-f6dd-475e-a3dc-1321a8ca5615",
   "target_node_id": "ba297c75-e891-4042-a6d9-a3e9eefa3b1a",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "57cc8da9-14dc-4efe-b993-b51d4448ddf1",
   "source_node_id": "366f9417-f6dd-475e-a3dc-1321a8ca5615",
   "target_node_id": "fe35e499-b99d-4a81-9698-041f75a32c8a",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "94f4daa7-b8cb-4e48-a241-0b7a6b4277e9",
   "source_node_id": "366f9417-f6dd-475e-a3dc-1321a8ca5615",
   "target_node_id": "7f6cc719-2108-4f50-83b7-6e80840830fd",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "46558568-4a45-4336-bee7-63c62db18215",
   "source_node_id": "366f9417-f6dd-475e-a3dc-1321a8ca5615",
   "target_node_id": "3a63d4b5-15fc-4fc4-b6f7-deacabb8828a",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "16a200c0-9759-4cac-a64b-702d442520d2",
   "source_node_id": "d3136c72-f4c8-453a-9aae-c65747c1265e",
   "target_node_id": "ba297c75-e891-4042-a6d9-a3e9eefa3b1a",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "deecad90-686a-4c1e-a031-a4f2f0ab9236",
   "source_node_id": "d3136c72-f4c8-453a-9aae-c65747c1265e",
   "target_node_id": "458c56a8-9d3b-4d27-ae16-6770939890ba",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "80deaf9e-2501-4fd7-919d-c7c6c836dc44",
   "source_node_id": "af38e816-d01a-4549-964d-e86377211ca9",
   "target_node_id": "7f6cc719-2108-4f50-83b7-6e80840830fd",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "bfe30d5b-2cac-4fe9-bd93-7bdf729db8e8",
   "source_node_id": "af38e816-d01a-4549-964d-e86377211ca9",
   "target_node_id": "458c56a8-9d3b-4d27-ae16-6770939890ba",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "918e1bce-0498-4ee9-8f1c-6481ef97f9f1",
   "source_node_id": "af38e816-d01a-4549-964d-e86377211ca9",
   "target_node_id": "f61865b8-07cf-4ead-8e0a-c14ab61aaee3",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "6d9844df-b3a7-4335-bb6c-f0248a1fd873",
   "source_node_id": "ba297c75-e891-4042-a6d9-a3e9eefa3b1a",
   "target_node_id": "fe35e499-b99d-4a81-9698-041f75a32c8a",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "e9822ada-f211-4f93-b009-99cf9ea21ee2",
   "source_node_id": "ba297c75-e891-4042-a6d9-a3e9eefa3b1a",
   "target_node_id": "648dfad3-4a0b-4f23-9910-5bca32dbe955",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "620cbb78-ed4e-4785-a3f9-306c298e3470",
   "source_node_id": "fe35e499-b99d-4a81-9698-041f75a32c8a",
   "target_node_id": "458c56a8-9d3b-4d27-ae16-6770939890ba",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "245339e7-f9d3-47de-937c-dbdd111524f6",
   "source_node_id": "056e06aa-8631-4e9b-877a-fb190a3c6323",
   "target_node_id": "640b80be-c1b8-4575-a1e3-e265a58e2a97",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "60a608ae-76a4-453f-a057-6388c5155bf7",
   "source_node_id": "056e06aa-8631-4e9b-877a-fb190a3c6323",
   "target_node_id": "f5232c8c-c342-44d3-a56c-1926c7ac0ff8",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "ceae2364-4a55-4ad2-8b2f-233c84611c39",
   "source_node_id": "640b80be-c1b8-4575-a1e3-e265a58e2a97",
   "target_node_id": "7f6cc719-2108-4f50-83b7-6e80840830fd",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "ee8b181d-9b3d-4136-ac52-6fd2d637b3a9",
   "source_node_id": "7f6cc719-2108-4f50-83b7-6e80840830fd",
   "target_node_id": "ac66a022-b873-46c9-bd81-cc74fcf58117",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "be12d4c7-8fac-4632-9013-91a0d34d4af8",
   "source_node_id": "7f6cc719-2108-4f50-83b7-6e80840830fd",
   "target_node_id": "648dfad3-4a0b-4f23-9910-5bca32dbe955",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "43fbde6f-32b0-45de-9527-f1cd932c255d",
   "source_node_id": "7f6cc719-2108-4f50-83b7-6e80840830fd",
   "target_node_id": "458c56a8-9d3b-4d27-ae16-6770939890ba",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "2544cc57-f1a9-495f-8591-86bce1870823",
   "source_node_id": "7f6cc719-2108-4f50-83b7-6e80840830fd",
   "target_node_id": "f61865b8-07cf-4ead-8e0a-c14ab61aaee3",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "0e3642a2-1a09-4788-bde9-5a390ef6500b",
   "source_node_id": "ebb592f5-81e0-403f-8922-a0edbb258d1c",
   "target_node_id": "9aa1dd2e-93e2-4304-af99-eca50c382775",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "50489382-d525-449d-97d8-0374e2a385f8",
   "source_node_id": "ebb592f5-81e0-403f-8922-a0edbb258d1c",
   "target_node_id": "decf25d6-3678-4346-8c12-61cfde63ac53",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "ec6e75d3-08e7-4928-89bc-5483fc3b4b17",
   "source_node_id": "ebb592f5-81e0-403f-8922-a0edbb258d1c",
   "target_node_id": "3d8dbd34-0ee1-4e4c-aceb-1225d3247110",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "6c976b9b-b5cf-421a-8252-b152dbbe5bb3",
   "source_node_id": "ebb592f5-81e0-403f-8922-a0edbb258d1c",
   "target_node_id": "172a8c43-e1eb-406b-941d-9b3a28cfe470",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "8cfa2c83-6140-456b-8048-06255a47a861",
   "source_node_id": "ebb592f5-81e0-403f-8922-a0edbb258d1c",
   "target_node_id": "458c56a8-9d3b-4d27-ae16-6770939890ba",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "675ea8c9-95e4-4d6c-97bf-e45feeb644ed",
   "source_node_id": "ebb592f5-81e0-403f-8922-a0edbb258d1c",
   "target_node_id": "3a63d4b5-15fc-4fc4-b6f7-deacabb8828a",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "89087ee8-78d5-4c9e-aa15-13f44e92021d",
   "source_node_id": "56d55022-f1f4-4b49-8afc-e27ca2dad6e9",
   "target_node_id": "ac66a022-b873-46c9-bd81-cc74fcf58117",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "0d413ba4-8c26-4c8d-b079-dee23fbd08d9",
   "source_node_id": "56d55022-f1f4-4b49-8afc-e27ca2dad6e9",
   "target_node_id": "458c56a8-9d3b-4d27-ae16-6770939890ba",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "2da8de77-a97b-4820-98a8-233b3526fc2c",
   "source_node_id": "901ccee3-3493-4256-bd1e-92a752ec7501",
   "target_node_id": "919f5095-a87f-4419-849b-af9c7d14a837",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "a7e09363-2187-4797-8c9c-ef498ed9fe13",
   "source_node_id": "901ccee3-3493-4256-bd1e-92a752ec7501",
   "target_node_id": "458c56a8-9d3b-4d27-ae16-6770939890ba",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "81e04fc9-86d0-4823-a47a-c35565b6f5e6",
   "source_node_id": "18c48cfa-7b5c-4020-9c2c-b77e79a7dbef",
   "target_node_id": "9aa1dd2e-93e2-4304-af99-eca50c382775",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "f6bc1cc7-65d0-45c8-88ff-c1dd30241b92",
   "source_node_id": "18c48cfa-7b5c-4020-9c2c-b77e79a7dbef",
   "target_node_id": "919f5095-a87f-4419-849b-af9c7d14a837",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "44a5974f-16ab-404b-a14b-509c85a883a3",
   "source_node_id": "9aa1dd2e-93e2-4304-af99-eca50c382775",
   "target_node_id": "919f5095-a87f-4419-849b-af9c7d14a837",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "7b3dc050-d6eb-4473-ab5f-21501364ab3b",
   "source_node_id": "9aa1dd2e-93e2-4304-af99-eca50c382775",
   "target_node_id": "648dfad3-4a0b-4f23-9910-5bca32dbe955",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "6ef7b9b2-6e07-405c-9f33-997682659e7c",
   "source_node_id": "9aa1dd2e-93e2-4304-af99-eca50c382775",
   "target_node_id": "b6dec9d7-cb95-4f3c-b12a-1c01bbe71b82",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "00df2315-f02a-4753-9cac-65fdd7d4370e",
   "source_node_id": "919f5095-a87f-4419-849b-af9c7d14a837",
   "target_node_id": "ac66a022-b873-46c9-bd81-cc74fcf58117",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "8fe03643-c598-425e-aae3-259fc4950c2b",
   "source_node_id": "919f5095-a87f-4419-849b-af9c7d14a837",
   "target_node_id": "458c56a8-9d3b-4d27-ae16-6770939890ba",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "8d38bc72-68fc-48ba-ad9a-c2495f8cf07f",
   "source_node_id": "919f5095-a87f-4419-849b-af9c7d14a837",
   "target_node_id": "3a63d4b5-15fc-4fc4-b6f7-deacabb8828a",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "ac12ebd3-2b63-4871-8d7f-efb4eee8feed",
   "source_node_id": "c5dd4d67-9089-409c-a38a-11a55d79ec51",
   "target_node_id": "f3200ee6-d3ab-4849-bbcb-ed6954c65b0f",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "205e6fda-5882-42d0-9573-edf42a1593a2",
   "source_node_id": "c5dd4d67-9089-409c-a38a-11a55d79ec51",
   "target_node_id": "f5232c8c-c342-44d3-a56c-1926c7ac0ff8",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "dc97a156-053b-4306-9008-29c16b24b6af",
   "source_node_id": "c5dd4d67-9089-409c-a38a-11a55d79ec51",
   "target_node_id": "3d8dbd34-0ee1-4e4c-aceb-1225d3247110",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "7c89d341-48d7-43fa-b692-69dd2114bed0",
   "source_node_id": "c5dd4d67-9089-409c-a38a-11a55d79ec51",
   "target_node_id": "458c56a8-9d3b-4d27-ae16-6770939890ba",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "73192196-75ae-4798-9e86-5f2cb4993065",
   "source_node_id": "f5232c8c-c342-44d3-a56c-1926c7ac0ff8",
   "target_node_id": "decf25d6-3678-4346-8c12-61cfde63ac53",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "c1ca8d82-8f29-4c60-b738-cde4e7cb74c3",
   "source_node_id": "ac66a022-b873-46c9-bd81-cc74fcf58117",
   "target_node_id": "648dfad3-4a0b-4f23-9910-5bca32dbe955",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "83f8f395-0395-48d5-ba32-13045a7eaaaf",
   "source_node_id": "648dfad3-4a0b-4f23-9910-5bca32dbe955",
   "target_node_id": "458c56a8-9d3b-4d27-ae16-6770939890ba",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "3e863c1c-53b9-41c3-a309-131ff09de53b",
   "source_node_id": "3d8dbd34-0ee1-4e4c-aceb-1225d3247110",
   "target_node_id": "172a8c43-e1eb-406b-941d-9b3a28cfe470",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "6622659c-6dbf-4f50-b97c-149436f8ba6e",
   "source_node_id": "3d8dbd34-0ee1-4e4c-aceb-1225d3247110",
   "target_node_id": "b6dec9d7-cb95-4f3c-b12a-1c01bbe71b82",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "057857dd-15d1-4849-9f87-6239aa4d8755",
   "source_node_id": "172a8c43-e1eb-406b-941d-9b3a28cfe470",
   "target_node_id": "b6dec9d7-cb95-4f3c-b12a-1c01bbe71b82",
   "edge_type": "prerequisite",
   "label": "前置知识"
  },
  {
   "id": "97aeb8b7-b082-407b-a075-b72eb0de0269",
   "source_node_id": "3276c931-cf7a-469e-a52d-9549ccf01819",
   "target_node_id": "733f0ac2-5a0d-409a-aaf6-980c6180448c",
   "edge_type": "requires",
   "label": "全景入口"
  },
  {
   "id": "7eb864eb-c798-4a62-9d5a-3dfa61f8093c",
   "source_node_id": "7305a41d-1a7f-4cbe-aab0-db66e48f7a73",
   "target_node_id": "d95e6e50-a6db-4d88-9706-c00fb276fbcb",
   "edge_type": "requires",
   "label": "支撑能力"
  },
  {
   "id": "ce11c4a5-dedc-408e-bf72-0cde3b80e968",
   "source_node_id": "b8c696d2-eb90-4462-a67c-46cb5e9271fd",
   "target_node_id": "d95e6e50-a6db-4d88-9706-c00fb276fbcb",
   "edge_type": "requires",
   "label": "支撑能力"
  },
  {
   "id": "59a8ea23-d729-428d-a327-6b989b9f0083",
   "source_node_id": "bd92e618-db3f-486d-8668-cdca815c0af3",
   "target_node_id": "d95e6e50-a6db-4d88-9706-c00fb276fbcb",
   "edge_type": "requires",
   "label": "支撑能力"
  },
  {
   "id": "23a99b19-eea4-407c-9949-1112c799f0b5",
   "source_node_id": "d3f2ac22-57b5-4643-a647-9f1a5f0a36ba",
   "target_node_id": "d95e6e50-a6db-4d88-9706-c00fb276fbcb",
   "edge_type": "requires",
   "label": "支撑能力"
  },
  {
   "id": "045c2f2f-4feb-4d05-8b93-171d3791ae42",
   "source_node_id": "c6e9be5e-ba1d-4d07-aeb1-92de85a1c58e",
   "target_node_id": "d95e6e50-a6db-4d88-9706-c00fb276fbcb",
   "edge_type": "requires",
   "label": "支撑能力"
  },
  {
   "id": "fb4a01f3-3cbd-4888-8cbe-02ac1738b461",
   "source_node_id": "3253d579-f0b7-4d31-b524-6070775a37a1",
   "target_node_id": "d95e6e50-a6db-4d88-9706-c00fb276fbcb",
   "edge_type": "requires",
   "label": "支撑能力"
  },
  {
   "id": "dfc3d114-931d-4cff-9107-65699d3a1407",
   "source_node_id": "b3d38af8-4dbf-4d07-a3bc-96b5992895c0",
   "target_node_id": "d95e6e50-a6db-4d88-9706-c00fb276fbcb",
   "edge_type": "requires",
   "label": "支撑能力"
  },
  {
   "id": "801fe5e8-a0d8-4f74-b18b-02d16ed25aa6",
   "source_node_id": "c5dd4d67-9089-409c-a38a-11a55d79ec51",
   "target_node_id": "d95e6e50-a6db-4d88-9706-c00fb276fbcb",
   "edge_type": "requires",
   "label": "支撑能力"
  },
  {
   "id": "05dcc9dd-d95b-44e4-8d4d-c9af05254a99",
   "source_node_id": "366f9417-f6dd-475e-a3dc-1321a8ca5615",
   "target_node_id": "34a4b130-5ed5-4cb1-a36c-d6ce73654628",
   "edge_type": "requires",
   "label": "支撑能力"
  },
  {
   "id": "d244d65c-85d1-4772-87e6-8ce38187508f",
   "source_node_id": "af38e816-d01a-4549-964d-e86377211ca9",
   "target_node_id": "34a4b130-5ed5-4cb1-a36c-d6ce73654628",
   "edge_type": "requires",
   "label": "支撑能力"
  },
  {
   "id": "116be70e-6b79-4aa6-80c7-3e29e265e694",
   "source_node_id": "9f3c356a-05a8-4bdf-90e4-d260721451cf",
   "target_node_id": "34a4b130-5ed5-4cb1-a36c-d6ce73654628",
   "edge_type": "requires",
   "label": "支撑能力"
  },
  {
   "id": "862949ca-d3bc-46c2-b349-4553fd6a362a",
   "source_node_id": "ced48831-6fff-409a-8ed9-4389d6bb13b0",
   "target_node_id": "34a4b130-5ed5-4cb1-a36c-d6ce73654628",
   "edge_type": "requires",
   "label": "支撑能力"
  },
  {
   "id": "9b9a6e4a-1f0a-4575-9035-c8410001b2fd",
   "source_node_id": "ba297c75-e891-4042-a6d9-a3e9eefa3b1a",
   "target_node_id": "34a4b130-5ed5-4cb1-a36c-d6ce73654628",
   "edge_type": "requires",
   "label": "支撑能力"
  },
  {
   "id": "514328b3-da48-4bb3-aabe-55768075795c",
   "source_node_id": "c6e9be5e-ba1d-4d07-aeb1-92de85a1c58e",
   "target_node_id": "994dc725-0d10-4f0a-94a1-d059e967496c",
   "edge_type": "requires",
   "label": "支撑能力"
  },
  {
   "id": "df3c4891-6977-490a-a0d7-33a97d792189",
   "source_node_id": "0acc2273-60b8-4d70-b3c2-7d6d66f78385",
   "target_node_id": "994dc725-0d10-4f0a-94a1-d059e967496c",
   "edge_type": "requires",
   "label": "支撑能力"
  },
  {
   "id": "6714ad85-bc26-4445-a027-7aa47324cd92",
   "source_node_id": "5e96d7a5-4c15-48b7-83a6-cc4075df5f34",
   "target_node_id": "994dc725-0d10-4f0a-94a1-d059e967496c",
   "edge_type": "requires",
   "label": "支撑能力"
  },
  {
   "id": "82a321a5-12ca-480d-ac1b-a38ea9d2fef5",
   "source_node_id": "bb3cffe2-8924-4584-ba84-a890a09d8c35",
   "target_node_id": "994dc725-0d10-4f0a-94a1-d059e967496c",
   "edge_type": "requires",
   "label": "支撑能力"
  },
  {
   "id": "731b6a79-1635-406d-a2b2-af1d9ffac631",
   "source_node_id": "553f1af2-7c28-43e3-9fe5-c1b2b5af93b7",
   "target_node_id": "3dbc4f38-22d1-4100-929d-d7ed83f9ad4d",
   "edge_type": "requires",
   "label": "支撑能力"
  },
  {
   "id": "bd7a2e45-0d9d-4ab2-9bf1-7fbb6e19b1ef",
   "source_node_id": "9f3c356a-05a8-4bdf-90e4-d260721451cf",
   "target_node_id": "3dbc4f38-22d1-4100-929d-d7ed83f9ad4d",
   "edge_type": "requires",
   "label": "支撑能力"
  },
  {
   "id": "e859335c-8d75-47c6-8d25-37c709306c47",
   "source_node_id": "0194790d-0689-4665-a4fb-b882e33e5a87",
   "target_node_id": "3dbc4f38-22d1-4100-929d-d7ed83f9ad4d",
   "edge_type": "requires",
   "label": "支撑能力"
  },
  {
   "id": "129d0716-d7e9-49eb-ac81-3e5704b7be18",
   "source_node_id": "ced48831-6fff-409a-8ed9-4389d6bb13b0",
   "target_node_id": "3dbc4f38-22d1-4100-929d-d7ed83f9ad4d",
   "edge_type": "requires",
   "label": "支撑能力"
  },
  {
   "id": "60095d6d-5e10-4770-ab1e-f38f72e718de",
   "source_node_id": "b9af692b-da07-40e5-a7fd-ab13d5af4838",
   "target_node_id": "6ce1a409-bb5a-4e74-bf27-bdb3dcd66e91",
   "edge_type": "requires",
   "label": "支撑能力"
  },
  {
   "id": "3c5fc5fe-42a7-4112-ab2d-0a21336141b2",
   "source_node_id": "ba297c75-e891-4042-a6d9-a3e9eefa3b1a",
   "target_node_id": "6ce1a409-bb5a-4e74-bf27-bdb3dcd66e91",
   "edge_type": "requires",
   "label": "支撑能力"
  },
  {
   "id": "6e884770-27a2-4f8c-aa4f-f598ca0ac8e0",
   "source_node_id": "ced48831-6fff-409a-8ed9-4389d6bb13b0",
   "target_node_id": "8ecdef36-a45e-42be-8aa8-874ce486a9cd",
   "edge_type": "requires",
   "label": "支撑能力"
  },
  {
   "id": "5620a97d-3903-4dd9-af0b-d74e7bdce664",
   "source_node_id": "fe35e499-b99d-4a81-9698-041f75a32c8a",
   "target_node_id": "8ecdef36-a45e-42be-8aa8-874ce486a9cd",
   "edge_type": "requires",
   "label": "支撑能力"
  },
  {
   "id": "c6567083-785d-43bc-96d1-a4da0a6595f5",
   "source_node_id": "901ccee3-3493-4256-bd1e-92a752ec7501",
   "target_node_id": "8ecdef36-a45e-42be-8aa8-874ce486a9cd",
   "edge_type": "requires",
   "label": "支撑能力"
  },
  {
   "id": "d2cc5383-49e5-4e52-8d2c-95a9d7266453",
   "source_node_id": "366f9417-f6dd-475e-a3dc-1321a8ca5615",
   "target_node_id": "9b680e50-fb59-4719-a1fe-c0063c4fba7f",
   "edge_type": "requires",
   "label": "支撑能力"
  },
  {
   "id": "8359b267-dc13-4c59-9908-c301d05f1db2",
   "source_node_id": "fe35e499-b99d-4a81-9698-041f75a32c8a",
   "target_node_id": "9b680e50-fb59-4719-a1fe-c0063c4fba7f",
   "edge_type": "requires",
   "label": "支撑能力"
  },
  {
   "id": "0e7942ef-b9f2-401b-bb65-a42d04f409ec",
   "source_node_id": "ac66a022-b873-46c9-bd81-cc74fcf58117",
   "target_node_id": "9b680e50-fb59-4719-a1fe-c0063c4fba7f",
   "edge_type": "requires",
   "label": "支撑能力"
  },
  {
   "id": "f9f63a1e-d594-41c0-95f0-a5715de74f7a",
   "source_node_id": "56d55022-f1f4-4b49-8afc-e27ca2dad6e9",
   "target_node_id": "9b680e50-fb59-4719-a1fe-c0063c4fba7f",
   "edge_type": "requires",
   "label": "支撑能力"
  },
  {
   "id": "e19ed8dc-4cf4-44f4-830d-e8c081538f8f",
   "source_node_id": "18c48cfa-7b5c-4020-9c2c-b77e79a7dbef",
   "target_node_id": "053ee5cb-d56f-4bed-93a1-2406d510144d",
   "edge_type": "requires",
   "label": "支撑能力"
  },
  {
   "id": "0cf5979d-d9a4-44e1-a502-813394ecc913",
   "source_node_id": "9aa1dd2e-93e2-4304-af99-eca50c382775",
   "target_node_id": "053ee5cb-d56f-4bed-93a1-2406d510144d",
   "edge_type": "requires",
   "label": "支撑能力"
  },
  {
   "id": "b223ad01-e1d2-47be-a3f9-fd5631c62844",
   "source_node_id": "919f5095-a87f-4419-849b-af9c7d14a837",
   "target_node_id": "053ee5cb-d56f-4bed-93a1-2406d510144d",
   "edge_type": "requires",
   "label": "支撑能力"
  },
  {
   "id": "0cac2df8-4ffe-498f-9a3a-e4c90089a2ae",
   "source_node_id": "0194790d-0689-4665-a4fb-b882e33e5a87",
   "target_node_id": "4da4a3b0-dc3b-473f-bb74-123792e5d36e",
   "edge_type": "requires",
   "label": "支撑能力"
  },
  {
   "id": "b0149f15-9717-4b92-aff8-5d3a9216ec4e",
   "source_node_id": "ced48831-6fff-409a-8ed9-4389d6bb13b0",
   "target_node_id": "4da4a3b0-dc3b-473f-bb74-123792e5d36e",
   "edge_type": "requires",
   "label": "支撑能力"
  },
  {
   "id": "a91c1aa0-a496-4463-9e6e-9b3bf5c49288",
   "source_node_id": "bb3cffe2-8924-4584-ba84-a890a09d8c35",
   "target_node_id": "4da4a3b0-dc3b-473f-bb74-123792e5d36e",
   "edge_type": "requires",
   "label": "支撑能力"
  },
  {
   "id": "986ede32-9ac0-4d0a-8d4b-e156022d3473",
   "source_node_id": "18c48cfa-7b5c-4020-9c2c-b77e79a7dbef",
   "target_node_id": "4da4a3b0-dc3b-473f-bb74-123792e5d36e",
   "edge_type": "requires",
   "label": "支撑能力"
  },
  {
   "id": "0a682d43-f498-418b-807c-759f27a80a89",
   "source_node_id": "648dfad3-4a0b-4f23-9910-5bca32dbe955",
   "target_node_id": "4da4a3b0-dc3b-473f-bb74-123792e5d36e",
   "edge_type": "requires",
   "label": "支撑能力"
  },
  {
   "id": "728d2c32-1a00-4f39-a3c0-dc9066bdf16f",
   "source_node_id": "056e06aa-8631-4e9b-877a-fb190a3c6323",
   "target_node_id": "1a2510f8-59cc-4781-ac7c-30278edbbdd4",
   "edge_type": "requires",
   "label": "支撑能力"
  },
  {
   "id": "493001c0-c35a-4fec-83cb-d23a144b0788",
   "source_node_id": "640b80be-c1b8-4575-a1e3-e265a58e2a97",
   "target_node_id": "1a2510f8-59cc-4781-ac7c-30278edbbdd4",
   "edge_type": "requires",
   "label": "支撑能力"
  },
  {
   "id": "b7f53f65-4ab1-4203-ac15-87aeb408699d",
   "source_node_id": "7f6cc719-2108-4f50-83b7-6e80840830fd",
   "target_node_id": "1a2510f8-59cc-4781-ac7c-30278edbbdd4",
   "edge_type": "requires",
   "label": "支撑能力"
  },
  {
   "id": "d9b6bc50-eee5-48cc-9788-0e1026d62ae2",
   "source_node_id": "648dfad3-4a0b-4f23-9910-5bca32dbe955",
   "target_node_id": "1a2510f8-59cc-4781-ac7c-30278edbbdd4",
   "edge_type": "requires",
   "label": "支撑能力"
  },
  {
   "id": "8db4f307-d126-4401-916e-fa7b3ade3c33",
   "source_node_id": "d95e6e50-a6db-4d88-9706-c00fb276fbcb",
   "target_node_id": "fad625b3-ad84-4e21-a970-6d4ff0770cc8",
   "edge_type": "requires",
   "label": "支撑能力"
  },
  {
   "id": "7a7bef74-a902-45b3-ad5d-59442d28273f",
   "source_node_id": "6ce1a409-bb5a-4e74-bf27-bdb3dcd66e91",
   "target_node_id": "fad625b3-ad84-4e21-a970-6d4ff0770cc8",
   "edge_type": "requires",
   "label": "支撑能力"
  },
  {
   "id": "6fca68d6-b883-42ce-9aff-bec100ab4401",
   "source_node_id": "8ecdef36-a45e-42be-8aa8-874ce486a9cd",
   "target_node_id": "fad625b3-ad84-4e21-a970-6d4ff0770cc8",
   "edge_type": "requires",
   "label": "支撑能力"
  },
  {
   "id": "229fd205-3bba-4d51-b834-04d7f326e8ac",
   "source_node_id": "b8c696d2-eb90-4462-a67c-46cb5e9271fd",
   "target_node_id": "fad625b3-ad84-4e21-a970-6d4ff0770cc8",
   "edge_type": "requires",
   "label": "支撑能力"
  },
  {
   "id": "be8e025c-f5db-4a6a-9b5a-f108ac7412af",
   "source_node_id": "901ccee3-3493-4256-bd1e-92a752ec7501",
   "target_node_id": "fad625b3-ad84-4e21-a970-6d4ff0770cc8",
   "edge_type": "requires",
   "label": "支撑能力"
  },
  {
   "id": "f3102dda-dbda-402e-be3d-a29d25c6b76a",
   "source_node_id": "994dc725-0d10-4f0a-94a1-d059e967496c",
   "target_node_id": "ff472852-abf0-4c46-97a1-23ff8fad686b",
   "edge_type": "requires",
   "label": "支撑能力"
  },
  {
   "id": "eefea76b-a78f-4b20-9dad-3be8eca8a04c",
   "source_node_id": "fad625b3-ad84-4e21-a970-6d4ff0770cc8",
   "target_node_id": "ff472852-abf0-4c46-97a1-23ff8fad686b",
   "edge_type": "requires",
   "label": "支撑能力"
  },
  {
   "id": "6e84ad21-fda2-4927-a464-9ccabbce6d8b",
   "source_node_id": "c6e9be5e-ba1d-4d07-aeb1-92de85a1c58e",
   "target_node_id": "ff472852-abf0-4c46-97a1-23ff8fad686b",
   "edge_type": "requires",
   "label": "支撑能力"
  },
  {
   "id": "4c4cf2c8-158c-4a30-b94a-082160f4af95",
   "source_node_id": "b9af692b-da07-40e5-a7fd-ab13d5af4838",
   "target_node_id": "ff472852-abf0-4c46-97a1-23ff8fad686b",
   "edge_type": "requires",
   "label": "支撑能力"
  },
  {
   "id": "2d96a79f-2eed-44e8-8f52-1d83b5a8aff1",
   "source_node_id": "d95e6e50-a6db-4d88-9706-c00fb276fbcb",
   "target_node_id": "6ef7c184-5fe7-4de6-bddf-1807d2a9afd1",
   "edge_type": "requires",
   "label": "支撑能力"
  },
  {
   "id": "017652fa-64fe-4a55-8f93-9a3bc359cad3",
   "source_node_id": "8ecdef36-a45e-42be-8aa8-874ce486a9cd",
   "target_node_id": "6ef7c184-5fe7-4de6-bddf-1807d2a9afd1",
   "edge_type": "requires",
   "label": "支撑能力"
  },
  {
   "id": "e3427f1e-0e5c-4840-a01e-31b114101c2d",
   "source_node_id": "053ee5cb-d56f-4bed-93a1-2406d510144d",
   "target_node_id": "6ef7c184-5fe7-4de6-bddf-1807d2a9afd1",
   "edge_type": "requires",
   "label": "支撑能力"
  },
  {
   "id": "00612042-2db8-46f0-8905-d88e762e0264",
   "source_node_id": "fad625b3-ad84-4e21-a970-6d4ff0770cc8",
   "target_node_id": "6ef7c184-5fe7-4de6-bddf-1807d2a9afd1",
   "edge_type": "requires",
   "label": "支撑能力"
  },
  {
   "id": "c67bc0a9-79c3-463b-9131-3242fb34b0d6",
   "source_node_id": "5e96d7a5-4c15-48b7-83a6-cc4075df5f34",
   "target_node_id": "6ef7c184-5fe7-4de6-bddf-1807d2a9afd1",
   "edge_type": "requires",
   "label": "支撑能力"
  },
  {
   "id": "af8976dd-fc46-4acd-88c8-991fcc4876ab",
   "source_node_id": "3253d579-f0b7-4d31-b524-6070775a37a1",
   "target_node_id": "6ef7c184-5fe7-4de6-bddf-1807d2a9afd1",
   "edge_type": "requires",
   "label": "支撑能力"
  },
  {
   "id": "4dcca5aa-d734-4102-a8c3-c5f3d8ef5d35",
   "source_node_id": "3a63d4b5-15fc-4fc4-b6f7-deacabb8828a",
   "target_node_id": "6ef7c184-5fe7-4de6-bddf-1807d2a9afd1",
   "edge_type": "requires",
   "label": "支撑能力"
  },
  {
   "id": "a765b71e-b619-41a6-9435-9493a3f822e7",
   "source_node_id": "3dbc4f38-22d1-4100-929d-d7ed83f9ad4d",
   "target_node_id": "9396dd36-85c1-4238-a573-ebf763b6ffdd",
   "edge_type": "requires",
   "label": "支撑能力"
  },
  {
   "id": "04af8053-1b9c-4aa7-99fe-a384784f0c0f",
   "source_node_id": "4da4a3b0-dc3b-473f-bb74-123792e5d36e",
   "target_node_id": "9396dd36-85c1-4238-a573-ebf763b6ffdd",
   "edge_type": "requires",
   "label": "支撑能力"
  },
  {
   "id": "19729a5c-5e6c-40ba-9843-87e45088ec31",
   "source_node_id": "fad625b3-ad84-4e21-a970-6d4ff0770cc8",
   "target_node_id": "9396dd36-85c1-4238-a573-ebf763b6ffdd",
   "edge_type": "requires",
   "label": "支撑能力"
  },
  {
   "id": "1a380629-6146-4086-84ff-98c9a68b3e2f",
   "source_node_id": "6ef7c184-5fe7-4de6-bddf-1807d2a9afd1",
   "target_node_id": "9396dd36-85c1-4238-a573-ebf763b6ffdd",
   "edge_type": "requires",
   "label": "支撑能力"
  },
  {
   "id": "80e8f4dc-6d0a-455f-a506-58465cd77ea7",
   "source_node_id": "ced48831-6fff-409a-8ed9-4389d6bb13b0",
   "target_node_id": "9396dd36-85c1-4238-a573-ebf763b6ffdd",
   "edge_type": "requires",
   "label": "支撑能力"
  },
  {
   "id": "987bae99-397b-4040-bd87-844315ad9e0b",
   "source_node_id": "ebb592f5-81e0-403f-8922-a0edbb258d1c",
   "target_node_id": "9396dd36-85c1-4238-a573-ebf763b6ffdd",
   "edge_type": "requires",
   "label": "支撑能力"
  },
  {
   "id": "16a08561-8eaf-4682-ba3b-97dac21e196b",
   "source_node_id": "8ecdef36-a45e-42be-8aa8-874ce486a9cd",
   "target_node_id": "d7ec020b-b6b5-4fbb-a0b1-54e296e06876",
   "edge_type": "requires",
   "label": "支撑能力"
  },
  {
   "id": "b68299ea-ada9-4e4e-9b74-ec6c61c851a9",
   "source_node_id": "9b680e50-fb59-4719-a1fe-c0063c4fba7f",
   "target_node_id": "d7ec020b-b6b5-4fbb-a0b1-54e296e06876",
   "edge_type": "requires",
   "label": "支撑能力"
  },
  {
   "id": "6129886b-bfe1-4e71-a5ca-341301680988",
   "source_node_id": "9396dd36-85c1-4238-a573-ebf763b6ffdd",
   "target_node_id": "d7ec020b-b6b5-4fbb-a0b1-54e296e06876",
   "edge_type": "requires",
   "label": "支撑能力"
  },
  {
   "id": "ee228a42-5948-4c51-aaab-51bf08aa1686",
   "source_node_id": "ebb592f5-81e0-403f-8922-a0edbb258d1c",
   "target_node_id": "d7ec020b-b6b5-4fbb-a0b1-54e296e06876",
   "edge_type": "requires",
   "label": "支撑能力"
  },
  {
   "id": "0b5fd63d-9343-4138-b536-55b32614d656",
   "source_node_id": "34a4b130-5ed5-4cb1-a36c-d6ce73654628",
   "target_node_id": "26c63236-ac4c-4958-88ae-f1472ec24a23",
   "edge_type": "requires",
   "label": "支撑能力"
  },
  {
   "id": "be4eaace-d614-4bec-bee3-1518c4e73a1f",
   "source_node_id": "994dc725-0d10-4f0a-94a1-d059e967496c",
   "target_node_id": "26c63236-ac4c-4958-88ae-f1472ec24a23",
   "edge_type": "requires",
   "label": "支撑能力"
  },
  {
   "id": "8632e0a2-72c5-444f-9aaa-64fa0db7c870",
   "source_node_id": "ff472852-abf0-4c46-97a1-23ff8fad686b",
   "target_node_id": "26c63236-ac4c-4958-88ae-f1472ec24a23",
   "edge_type": "requires",
   "label": "支撑能力"
  },
  {
   "id": "d730e9bb-46cd-414a-909c-8ff906b48930",
   "source_node_id": "9396dd36-85c1-4238-a573-ebf763b6ffdd",
   "target_node_id": "26c63236-ac4c-4958-88ae-f1472ec24a23",
   "edge_type": "requires",
   "label": "支撑能力"
  },
  {
   "id": "58a4bd9e-5e32-4e67-be77-d62c8a432fb8",
   "source_node_id": "bc4df4b4-7cdf-41dd-8d3e-656bd47df8b4",
   "target_node_id": "26c63236-ac4c-4958-88ae-f1472ec24a23",
   "edge_type": "requires",
   "label": "支撑能力"
  },
  {
   "id": "08e59834-9b79-4eba-89f7-42fc75ccd1a1",
   "source_node_id": "a017d8e0-924a-4c3d-938f-8c9ebdca6f92",
   "target_node_id": "26c63236-ac4c-4958-88ae-f1472ec24a23",
   "edge_type": "requires",
   "label": "支撑能力"
  },
  {
   "id": "7dd4e645-8799-4610-ac0f-b6068cd21705",
   "source_node_id": "af38e816-d01a-4549-964d-e86377211ca9",
   "target_node_id": "26c63236-ac4c-4958-88ae-f1472ec24a23",
   "edge_type": "requires",
   "label": "支撑能力"
  },
  {
   "id": "b150f653-5188-448a-9a7d-c106ae4bfda0",
   "source_node_id": "ba297c75-e891-4042-a6d9-a3e9eefa3b1a",
   "target_node_id": "26c63236-ac4c-4958-88ae-f1472ec24a23",
   "edge_type": "requires",
   "label": "支撑能力"
  },
  {
   "id": "e6e9bb19-0240-49c8-97d5-6f2ea19a970b",
   "source_node_id": "3dbc4f38-22d1-4100-929d-d7ed83f9ad4d",
   "target_node_id": "fd49554d-1307-4351-8dcb-93b01e66de67",
   "edge_type": "requires",
   "label": "支撑能力"
  },
  {
   "id": "be756d4b-5250-4e29-890d-4f4423b974ca",
   "source_node_id": "9396dd36-85c1-4238-a573-ebf763b6ffdd",
   "target_node_id": "fd49554d-1307-4351-8dcb-93b01e66de67",
   "edge_type": "requires",
   "label": "支撑能力"
  },
  {
   "id": "1561e744-9144-4f54-b6df-0e43932b78f9",
   "source_node_id": "26c63236-ac4c-4958-88ae-f1472ec24a23",
   "target_node_id": "fd49554d-1307-4351-8dcb-93b01e66de67",
   "edge_type": "requires",
   "label": "支撑能力"
  },
  {
   "id": "fa9dbbf9-f715-4b42-b4fe-bb8ae3bce536",
   "source_node_id": "ced48831-6fff-409a-8ed9-4389d6bb13b0",
   "target_node_id": "fd49554d-1307-4351-8dcb-93b01e66de67",
   "edge_type": "requires",
   "label": "支撑能力"
  },
  {
   "id": "da184cc7-6ca7-4ea7-8730-d39324a25b5b",
   "source_node_id": "af38e816-d01a-4549-964d-e86377211ca9",
   "target_node_id": "fd49554d-1307-4351-8dcb-93b01e66de67",
   "edge_type": "requires",
   "label": "支撑能力"
  },
  {
   "id": "cb25a828-6565-4595-afea-a7c524deb273",
   "source_node_id": "994dc725-0d10-4f0a-94a1-d059e967496c",
   "target_node_id": "38f1f5db-4545-4a94-969d-d058da472827",
   "edge_type": "requires",
   "label": "支撑能力"
  },
  {
   "id": "67602130-0003-427b-9f84-f11e9c053ca1",
   "source_node_id": "26c63236-ac4c-4958-88ae-f1472ec24a23",
   "target_node_id": "38f1f5db-4545-4a94-969d-d058da472827",
   "edge_type": "requires",
   "label": "支撑能力"
  },
  {
   "id": "75f0dbc7-0201-4bce-8912-cfb219401d70",
   "source_node_id": "fd49554d-1307-4351-8dcb-93b01e66de67",
   "target_node_id": "38f1f5db-4545-4a94-969d-d058da472827",
   "edge_type": "requires",
   "label": "支撑能力"
  },
  {
   "id": "9ae60e7b-0cdd-4f00-9d2b-51b2b89b2552",
   "source_node_id": "c6e9be5e-ba1d-4d07-aeb1-92de85a1c58e",
   "target_node_id": "38f1f5db-4545-4a94-969d-d058da472827",
   "edge_type": "requires",
   "label": "支撑能力"
  },
  {
   "id": "e0a1ef00-402f-4bc8-a051-e7b841a1c955",
   "source_node_id": "bb3cffe2-8924-4584-ba84-a890a09d8c35",
   "target_node_id": "38f1f5db-4545-4a94-969d-d058da472827",
   "edge_type": "requires",
   "label": "支撑能力"
  },
  {
   "id": "502c0770-faa8-4c60-9ec5-56416671696e",
   "source_node_id": "ba297c75-e891-4042-a6d9-a3e9eefa3b1a",
   "target_node_id": "38f1f5db-4545-4a94-969d-d058da472827",
   "edge_type": "requires",
   "label": "支撑能力"
  },
  {
   "id": "866dda95-9329-4e40-ad22-75ec4c188a5b",
   "source_node_id": "34a4b130-5ed5-4cb1-a36c-d6ce73654628",
   "target_node_id": "feec11df-1cea-4555-9f42-e609ee04458b",
   "edge_type": "requires",
   "label": "支撑能力"
  },
  {
   "id": "2e1159ec-b848-4978-9a46-63ac862db8f7",
   "source_node_id": "6ce1a409-bb5a-4e74-bf27-bdb3dcd66e91",
   "target_node_id": "feec11df-1cea-4555-9f42-e609ee04458b",
   "edge_type": "requires",
   "label": "支撑能力"
  },
  {
   "id": "e962652e-54fc-4dcd-a9ac-e281014b5671",
   "source_node_id": "4da4a3b0-dc3b-473f-bb74-123792e5d36e",
   "target_node_id": "feec11df-1cea-4555-9f42-e609ee04458b",
   "edge_type": "requires",
   "label": "支撑能力"
  },
  {
   "id": "bd893c11-ed2f-402e-8d31-18caa651f02d",
   "source_node_id": "38f1f5db-4545-4a94-969d-d058da472827",
   "target_node_id": "feec11df-1cea-4555-9f42-e609ee04458b",
   "edge_type": "requires",
   "label": "支撑能力"
  },
  {
   "id": "cc1069bb-44d9-4543-a96d-ff58d6711a41",
   "source_node_id": "1a2510f8-59cc-4781-ac7c-30278edbbdd4",
   "target_node_id": "9f6a8605-5e00-4b89-99ea-0ef566f4d1ae",
   "edge_type": "requires",
   "label": "支撑能力"
  },
  {
   "id": "ff22ef47-673d-437d-afc6-3d231d6fe0f9",
   "source_node_id": "ff472852-abf0-4c46-97a1-23ff8fad686b",
   "target_node_id": "9f6a8605-5e00-4b89-99ea-0ef566f4d1ae",
   "edge_type": "requires",
   "label": "支撑能力"
  },
  {
   "id": "a4938219-2671-4028-971a-07c3e739098e",
   "source_node_id": "9396dd36-85c1-4238-a573-ebf763b6ffdd",
   "target_node_id": "9f6a8605-5e00-4b89-99ea-0ef566f4d1ae",
   "edge_type": "requires",
   "label": "支撑能力"
  },
  {
   "id": "cf176a3c-ff88-43fa-8ed7-a54908c5d655",
   "source_node_id": "38f1f5db-4545-4a94-969d-d058da472827",
   "target_node_id": "9f6a8605-5e00-4b89-99ea-0ef566f4d1ae",
   "edge_type": "requires",
   "label": "支撑能力"
  },
  {
   "id": "f3078ac0-ff94-400d-b990-4ce1d46d1fa1",
   "source_node_id": "056e06aa-8631-4e9b-877a-fb190a3c6323",
   "target_node_id": "9f6a8605-5e00-4b89-99ea-0ef566f4d1ae",
   "edge_type": "requires",
   "label": "支撑能力"
  },
  {
   "id": "6bb2894d-9db8-48b9-a862-809c261eb76a",
   "source_node_id": "7f6cc719-2108-4f50-83b7-6e80840830fd",
   "target_node_id": "9f6a8605-5e00-4b89-99ea-0ef566f4d1ae",
   "edge_type": "requires",
   "label": "支撑能力"
  },
  {
   "id": "020f6e6f-8a26-4e02-a8d6-78fd1c4c1fcf",
   "source_node_id": "919f5095-a87f-4419-849b-af9c7d14a837",
   "target_node_id": "9f6a8605-5e00-4b89-99ea-0ef566f4d1ae",
   "edge_type": "requires",
   "label": "支撑能力"
  },
  {
   "id": "04ae1562-656e-4098-9825-1ada696ccfa7",
   "source_node_id": "9b680e50-fb59-4719-a1fe-c0063c4fba7f",
   "target_node_id": "2e7f9afc-51c4-499b-9c7e-da6b95991f04",
   "edge_type": "requires",
   "label": "支撑能力"
  },
  {
   "id": "6d60c615-2f6b-4e68-babf-82dd9fa68ed7",
   "source_node_id": "053ee5cb-d56f-4bed-93a1-2406d510144d",
   "target_node_id": "2e7f9afc-51c4-499b-9c7e-da6b95991f04",
   "edge_type": "requires",
   "label": "支撑能力"
  },
  {
   "id": "aac720f3-807c-4c56-9070-7145cd7f5613",
   "source_node_id": "fad625b3-ad84-4e21-a970-6d4ff0770cc8",
   "target_node_id": "2e7f9afc-51c4-499b-9c7e-da6b95991f04",
   "edge_type": "requires",
   "label": "支撑能力"
  },
  {
   "id": "7cc01de7-aa93-43f1-bbd2-eedbc9fc95c9",
   "source_node_id": "9396dd36-85c1-4238-a573-ebf763b6ffdd",
   "target_node_id": "2e7f9afc-51c4-499b-9c7e-da6b95991f04",
   "edge_type": "requires",
   "label": "支撑能力"
  },
  {
   "id": "6c2934e5-1ef4-41a9-8938-c0f8e610c57a",
   "source_node_id": "9f6a8605-5e00-4b89-99ea-0ef566f4d1ae",
   "target_node_id": "2e7f9afc-51c4-499b-9c7e-da6b95991f04",
   "edge_type": "requires",
   "label": "支撑能力"
  },
  {
   "id": "1ede7f97-65c6-4452-add5-ae67cca483da",
   "source_node_id": "18c48cfa-7b5c-4020-9c2c-b77e79a7dbef",
   "target_node_id": "2e7f9afc-51c4-499b-9c7e-da6b95991f04",
   "edge_type": "requires",
   "label": "支撑能力"
  },
  {
   "id": "d57a65a4-eaee-4e29-af1b-5c0e64553c98",
   "source_node_id": "919f5095-a87f-4419-849b-af9c7d14a837",
   "target_node_id": "2e7f9afc-51c4-499b-9c7e-da6b95991f04",
   "edge_type": "requires",
   "label": "支撑能力"
  },
  {
   "id": "6353a0a2-ba5c-4824-8382-6241b685ddee",
   "source_node_id": "34a4b130-5ed5-4cb1-a36c-d6ce73654628",
   "target_node_id": "3733cc5d-2799-4840-8695-7caedb44689c",
   "edge_type": "requires",
   "label": "支撑能力"
  },
  {
   "id": "86a7b10b-7802-439a-a846-f6ef98260d21",
   "source_node_id": "3dbc4f38-22d1-4100-929d-d7ed83f9ad4d",
   "target_node_id": "3733cc5d-2799-4840-8695-7caedb44689c",
   "edge_type": "requires",
   "label": "支撑能力"
  },
  {
   "id": "8de39e6f-24b8-494c-a942-ac0e088f7459",
   "source_node_id": "4da4a3b0-dc3b-473f-bb74-123792e5d36e",
   "target_node_id": "3733cc5d-2799-4840-8695-7caedb44689c",
   "edge_type": "requires",
   "label": "支撑能力"
  },
  {
   "id": "b3553508-e974-4450-8a5e-01a04e3c03eb",
   "source_node_id": "ff472852-abf0-4c46-97a1-23ff8fad686b",
   "target_node_id": "3733cc5d-2799-4840-8695-7caedb44689c",
   "edge_type": "requires",
   "label": "支撑能力"
  },
  {
   "id": "4d4616c1-5ade-49cb-8717-b6026f3ef980",
   "source_node_id": "38f1f5db-4545-4a94-969d-d058da472827",
   "target_node_id": "3733cc5d-2799-4840-8695-7caedb44689c",
   "edge_type": "requires",
   "label": "支撑能力"
  },
  {
   "id": "582bc0e2-bae0-4e9f-ae13-01d2a9101727",
   "source_node_id": "9f6a8605-5e00-4b89-99ea-0ef566f4d1ae",
   "target_node_id": "3733cc5d-2799-4840-8695-7caedb44689c",
   "edge_type": "requires",
   "label": "支撑能力"
  },
  {
   "id": "fad3cbc3-71c0-437a-957c-e7fd81dc1f27",
   "source_node_id": "9f3c356a-05a8-4bdf-90e4-d260721451cf",
   "target_node_id": "3733cc5d-2799-4840-8695-7caedb44689c",
   "edge_type": "requires",
   "label": "支撑能力"
  },
  {
   "id": "6cc2f97b-389c-4f10-9508-a82170963ad4",
   "source_node_id": "ebb592f5-81e0-403f-8922-a0edbb258d1c",
   "target_node_id": "3733cc5d-2799-4840-8695-7caedb44689c",
   "edge_type": "requires",
   "label": "支撑能力"
  },
  {
   "id": "b88f0d2e-e389-40ef-9162-167332b32c93",
   "source_node_id": "56d55022-f1f4-4b49-8afc-e27ca2dad6e9",
   "target_node_id": "3733cc5d-2799-4840-8695-7caedb44689c",
   "edge_type": "requires",
   "label": "支撑能力"
  },
  {
   "id": "62fa59f2-5979-42b9-af14-e4efd932e420",
   "source_node_id": "34a4b130-5ed5-4cb1-a36c-d6ce73654628",
   "target_node_id": "8022a5d7-cf57-43c3-97ad-7b58cd0d837c",
   "edge_type": "requires",
   "label": "支撑能力"
  },
  {
   "id": "3325358d-dc90-43e7-ab25-3f8b13e4e32f",
   "source_node_id": "4da4a3b0-dc3b-473f-bb74-123792e5d36e",
   "target_node_id": "8022a5d7-cf57-43c3-97ad-7b58cd0d837c",
   "edge_type": "requires",
   "label": "支撑能力"
  },
  {
   "id": "66648e31-fde7-4bc3-95ae-42866df0c2ae",
   "source_node_id": "d7ec020b-b6b5-4fbb-a0b1-54e296e06876",
   "target_node_id": "8022a5d7-cf57-43c3-97ad-7b58cd0d837c",
   "edge_type": "requires",
   "label": "支撑能力"
  },
  {
   "id": "8fc9cfcb-76eb-40b1-9e36-0013f4b87196",
   "source_node_id": "9f3c356a-05a8-4bdf-90e4-d260721451cf",
   "target_node_id": "8022a5d7-cf57-43c3-97ad-7b58cd0d837c",
   "edge_type": "requires",
   "label": "支撑能力"
  },
  {
   "id": "53d6d209-a76a-4aba-ac1c-83074e222bea",
   "source_node_id": "ebb592f5-81e0-403f-8922-a0edbb258d1c",
   "target_node_id": "8022a5d7-cf57-43c3-97ad-7b58cd0d837c",
   "edge_type": "requires",
   "label": "支撑能力"
  },
  {
   "id": "6efddde3-0962-401d-924b-30e0bff25c0f",
   "source_node_id": "34a4b130-5ed5-4cb1-a36c-d6ce73654628",
   "target_node_id": "e9431600-540c-4d6c-abf4-beb041d8e132",
   "edge_type": "requires",
   "label": "支撑能力"
  },
  {
   "id": "bea40356-b2a8-40f8-8fa2-528a4b4791aa",
   "source_node_id": "3dbc4f38-22d1-4100-929d-d7ed83f9ad4d",
   "target_node_id": "e9431600-540c-4d6c-abf4-beb041d8e132",
   "edge_type": "requires",
   "label": "支撑能力"
  },
  {
   "id": "75eeff94-dd83-447b-844b-703a5863c9c7",
   "source_node_id": "8ecdef36-a45e-42be-8aa8-874ce486a9cd",
   "target_node_id": "e9431600-540c-4d6c-abf4-beb041d8e132",
   "edge_type": "requires",
   "label": "支撑能力"
  },
  {
   "id": "6cc56397-b574-427c-9ddf-548782b29939",
   "source_node_id": "9b680e50-fb59-4719-a1fe-c0063c4fba7f",
   "target_node_id": "e9431600-540c-4d6c-abf4-beb041d8e132",
   "edge_type": "requires",
   "label": "支撑能力"
  },
  {
   "id": "6f15fb76-ff68-4c6e-8655-88d4894a49e7",
   "source_node_id": "4da4a3b0-dc3b-473f-bb74-123792e5d36e",
   "target_node_id": "e9431600-540c-4d6c-abf4-beb041d8e132",
   "edge_type": "requires",
   "label": "支撑能力"
  },
  {
   "id": "c822fe59-d545-463e-a840-d7c8cc9c626a",
   "source_node_id": "34a4b130-5ed5-4cb1-a36c-d6ce73654628",
   "target_node_id": "8c205814-b523-429b-b297-f636abd44f06",
   "edge_type": "requires",
   "label": "支撑能力"
  },
  {
   "id": "3136db92-f9c0-4373-b049-0d8a0775cbce",
   "source_node_id": "6ef7c184-5fe7-4de6-bddf-1807d2a9afd1",
   "target_node_id": "8c205814-b523-429b-b297-f636abd44f06",
   "edge_type": "requires",
   "label": "支撑能力"
  },
  {
   "id": "25980bd6-d3cc-4275-a81b-bf1cf7bbf118",
   "source_node_id": "2e7f9afc-51c4-499b-9c7e-da6b95991f04",
   "target_node_id": "8c205814-b523-429b-b297-f636abd44f06",
   "edge_type": "requires",
   "label": "支撑能力"
  },
  {
   "id": "0e43728a-ba8d-4927-9dd8-f4f1f48db660",
   "source_node_id": "ac66a022-b873-46c9-bd81-cc74fcf58117",
   "target_node_id": "8c205814-b523-429b-b297-f636abd44f06",
   "edge_type": "requires",
   "label": "支撑能力"
  },
  {
   "id": "7f9f0176-96b1-4f29-a534-8355df68f12d",
   "source_node_id": "3a63d4b5-15fc-4fc4-b6f7-deacabb8828a",
   "target_node_id": "8c205814-b523-429b-b297-f636abd44f06",
   "edge_type": "requires",
   "label": "支撑能力"
  },
  {
   "id": "5f00abf3-f3e6-465a-bf2a-860b2cbf34ca",
   "source_node_id": "9396dd36-85c1-4238-a573-ebf763b6ffdd",
   "target_node_id": "0abf4fff-3741-40f6-87c9-c3b49fa95130",
   "edge_type": "requires",
   "label": "支撑能力"
  },
  {
   "id": "6170b654-8ea4-4e80-8d06-1da4f727e98b",
   "source_node_id": "d7ec020b-b6b5-4fbb-a0b1-54e296e06876",
   "target_node_id": "0abf4fff-3741-40f6-87c9-c3b49fa95130",
   "edge_type": "requires",
   "label": "支撑能力"
  },
  {
   "id": "af486740-72d3-45d5-af4a-4320e9c9c8a1",
   "source_node_id": "26c63236-ac4c-4958-88ae-f1472ec24a23",
   "target_node_id": "0abf4fff-3741-40f6-87c9-c3b49fa95130",
   "edge_type": "requires",
   "label": "支撑能力"
  },
  {
   "id": "913362b8-6ecc-4538-9adc-cf03ed8bbc2c",
   "source_node_id": "9f6a8605-5e00-4b89-99ea-0ef566f4d1ae",
   "target_node_id": "0abf4fff-3741-40f6-87c9-c3b49fa95130",
   "edge_type": "requires",
   "label": "支撑能力"
  },
  {
   "id": "4bd7e863-5e0e-4216-9344-98d40231befe",
   "source_node_id": "2e7f9afc-51c4-499b-9c7e-da6b95991f04",
   "target_node_id": "0abf4fff-3741-40f6-87c9-c3b49fa95130",
   "edge_type": "requires",
   "label": "支撑能力"
  },
  {
   "id": "f312cc05-ace6-41eb-83bd-585ec9cba08a",
   "source_node_id": "decf25d6-3678-4346-8c12-61cfde63ac53",
   "target_node_id": "0abf4fff-3741-40f6-87c9-c3b49fa95130",
   "edge_type": "requires",
   "label": "支撑能力"
  },
  {
   "id": "aaa0b318-61ee-4cbe-a5be-031f65736f92",
   "source_node_id": "3d8dbd34-0ee1-4e4c-aceb-1225d3247110",
   "target_node_id": "0abf4fff-3741-40f6-87c9-c3b49fa95130",
   "edge_type": "requires",
   "label": "支撑能力"
  },
  {
   "id": "c0c1d180-093c-4f15-bdab-ef27db082e94",
   "source_node_id": "172a8c43-e1eb-406b-941d-9b3a28cfe470",
   "target_node_id": "0abf4fff-3741-40f6-87c9-c3b49fa95130",
   "edge_type": "requires",
   "label": "支撑能力"
  },
  {
   "id": "8d95f38c-56de-4b8a-8132-3aaf306bfb27",
   "source_node_id": "34a4b130-5ed5-4cb1-a36c-d6ce73654628",
   "target_node_id": "3561dfc1-d964-432b-b753-6fd96e808bb8",
   "edge_type": "requires",
   "label": "支撑能力"
  },
  {
   "id": "06ccb83b-83fa-4a5d-878f-66a077a7df5b",
   "source_node_id": "6ce1a409-bb5a-4e74-bf27-bdb3dcd66e91",
   "target_node_id": "3561dfc1-d964-432b-b753-6fd96e808bb8",
   "edge_type": "requires",
   "label": "支撑能力"
  },
  {
   "id": "e5f7047c-4ec8-46a3-92ca-398e6680a9e1",
   "source_node_id": "d7ec020b-b6b5-4fbb-a0b1-54e296e06876",
   "target_node_id": "3561dfc1-d964-432b-b753-6fd96e808bb8",
   "edge_type": "requires",
   "label": "支撑能力"
  },
  {
   "id": "0ba7d31e-7871-46a1-b2f8-3fbddfbd99e5",
   "source_node_id": "26c63236-ac4c-4958-88ae-f1472ec24a23",
   "target_node_id": "3561dfc1-d964-432b-b753-6fd96e808bb8",
   "edge_type": "requires",
   "label": "支撑能力"
  },
  {
   "id": "5ce966b7-4b0b-4055-a9a3-7fd48c6a6eb6",
   "source_node_id": "fd49554d-1307-4351-8dcb-93b01e66de67",
   "target_node_id": "3561dfc1-d964-432b-b753-6fd96e808bb8",
   "edge_type": "requires",
   "label": "支撑能力"
  },
  {
   "id": "f51987e6-a2e0-49a1-8ab1-b1708d39a9fd",
   "source_node_id": "38f1f5db-4545-4a94-969d-d058da472827",
   "target_node_id": "3561dfc1-d964-432b-b753-6fd96e808bb8",
   "edge_type": "requires",
   "label": "支撑能力"
  },
  {
   "id": "13cb384f-dcb4-4716-aaf9-bb300e9cbafa",
   "source_node_id": "9b680e50-fb59-4719-a1fe-c0063c4fba7f",
   "target_node_id": "0307ea0f-0779-4355-a4e7-b9f9d40e111a",
   "edge_type": "requires",
   "label": "支撑能力"
  },
  {
   "id": "15215942-2307-4520-abd5-c6c694182236",
   "source_node_id": "053ee5cb-d56f-4bed-93a1-2406d510144d",
   "target_node_id": "0307ea0f-0779-4355-a4e7-b9f9d40e111a",
   "edge_type": "requires",
   "label": "支撑能力"
  },
  {
   "id": "c3793ded-b4c6-4ee2-898e-23192f167e2a",
   "source_node_id": "fad625b3-ad84-4e21-a970-6d4ff0770cc8",
   "target_node_id": "0307ea0f-0779-4355-a4e7-b9f9d40e111a",
   "edge_type": "requires",
   "label": "支撑能力"
  },
  {
   "id": "978a36ea-c3e4-40c7-b333-fd063c37b486",
   "source_node_id": "9f6a8605-5e00-4b89-99ea-0ef566f4d1ae",
   "target_node_id": "0307ea0f-0779-4355-a4e7-b9f9d40e111a",
   "edge_type": "requires",
   "label": "支撑能力"
  },
  {
   "id": "75f124bb-d275-4255-8974-7584d5ac9e0e",
   "source_node_id": "2e7f9afc-51c4-499b-9c7e-da6b95991f04",
   "target_node_id": "0307ea0f-0779-4355-a4e7-b9f9d40e111a",
   "edge_type": "requires",
   "label": "支撑能力"
  },
  {
   "id": "90dfb516-0249-404d-b099-fdba5de2b49f",
   "source_node_id": "56d55022-f1f4-4b49-8afc-e27ca2dad6e9",
   "target_node_id": "0307ea0f-0779-4355-a4e7-b9f9d40e111a",
   "edge_type": "requires",
   "label": "支撑能力"
  },
  {
   "id": "e84be5b0-759b-4f4b-b679-d7ec9c88992a",
   "source_node_id": "ac66a022-b873-46c9-bd81-cc74fcf58117",
   "target_node_id": "0307ea0f-0779-4355-a4e7-b9f9d40e111a",
   "edge_type": "requires",
   "label": "支撑能力"
  },
  {
   "id": "d9b2d4d6-9d4c-47bc-9e21-1e3ed4116a26",
   "source_node_id": "d95e6e50-a6db-4d88-9706-c00fb276fbcb",
   "target_node_id": "e3fbf1fc-e021-469a-bab7-6296461a528b",
   "edge_type": "requires",
   "label": "支撑能力"
  },
  {
   "id": "0b62db88-c30b-410f-a443-5ccca23c6546",
   "source_node_id": "3dbc4f38-22d1-4100-929d-d7ed83f9ad4d",
   "target_node_id": "e3fbf1fc-e021-469a-bab7-6296461a528b",
   "edge_type": "requires",
   "label": "支撑能力"
  },
  {
   "id": "91391ace-567d-44cf-a7c5-d9c133a054a8",
   "source_node_id": "8ecdef36-a45e-42be-8aa8-874ce486a9cd",
   "target_node_id": "e3fbf1fc-e021-469a-bab7-6296461a528b",
   "edge_type": "requires",
   "label": "支撑能力"
  },
  {
   "id": "64bb8a44-1a00-470f-aed0-2b28c6e9bf5a",
   "source_node_id": "053ee5cb-d56f-4bed-93a1-2406d510144d",
   "target_node_id": "e3fbf1fc-e021-469a-bab7-6296461a528b",
   "edge_type": "requires",
   "label": "支撑能力"
  },
  {
   "id": "5b31330d-2201-479c-9307-b417320dae80",
   "source_node_id": "9396dd36-85c1-4238-a573-ebf763b6ffdd",
   "target_node_id": "e3fbf1fc-e021-469a-bab7-6296461a528b",
   "edge_type": "requires",
   "label": "支撑能力"
  },
  {
   "id": "fce52130-2e2d-4ecd-bf8f-f23d41d677be",
   "source_node_id": "d7ec020b-b6b5-4fbb-a0b1-54e296e06876",
   "target_node_id": "e3fbf1fc-e021-469a-bab7-6296461a528b",
   "edge_type": "requires",
   "label": "支撑能力"
  },
  {
   "id": "7695d768-9a12-4dbf-a67f-9fb8188cfad1",
   "source_node_id": "f5232c8c-c342-44d3-a56c-1926c7ac0ff8",
   "target_node_id": "e3fbf1fc-e021-469a-bab7-6296461a528b",
   "edge_type": "requires",
   "label": "支撑能力"
  },
  {
   "id": "a3abb862-eaf4-4c91-82a0-a12c54212000",
   "source_node_id": "decf25d6-3678-4346-8c12-61cfde63ac53",
   "target_node_id": "e3fbf1fc-e021-469a-bab7-6296461a528b",
   "edge_type": "requires",
   "label": "支撑能力"
  },
  {
   "id": "04a21afd-2b63-4d09-9ce4-983c986502d4",
   "source_node_id": "3d8dbd34-0ee1-4e4c-aceb-1225d3247110",
   "target_node_id": "e3fbf1fc-e021-469a-bab7-6296461a528b",
   "edge_type": "requires",
   "label": "支撑能力"
  },
  {
   "id": "0fc4793b-0cc8-4202-b64e-525f899746de",
   "source_node_id": "172a8c43-e1eb-406b-941d-9b3a28cfe470",
   "target_node_id": "e3fbf1fc-e021-469a-bab7-6296461a528b",
   "edge_type": "requires",
   "label": "支撑能力"
  },
  {
   "id": "16ab2ebd-7367-454d-b1c5-06efecc1f9c7",
   "source_node_id": "b6dec9d7-cb95-4f3c-b12a-1c01bbe71b82",
   "target_node_id": "e3fbf1fc-e021-469a-bab7-6296461a528b",
   "edge_type": "requires",
   "label": "支撑能力"
  },
  {
   "id": "4505e62f-e7d9-4b38-aaf1-bd22d7898ea4",
   "source_node_id": "6ce1a409-bb5a-4e74-bf27-bdb3dcd66e91",
   "target_node_id": "9d0f563b-a0c7-4d49-bc5d-a61d238c3a8e",
   "edge_type": "requires",
   "label": "支撑能力"
  },
  {
   "id": "59478abf-86b2-4acb-8a48-97510b49f648",
   "source_node_id": "053ee5cb-d56f-4bed-93a1-2406d510144d",
   "target_node_id": "9d0f563b-a0c7-4d49-bc5d-a61d238c3a8e",
   "edge_type": "requires",
   "label": "支撑能力"
  },
  {
   "id": "dab96444-b059-4f33-bc47-fb9e17f725e9",
   "source_node_id": "4da4a3b0-dc3b-473f-bb74-123792e5d36e",
   "target_node_id": "9d0f563b-a0c7-4d49-bc5d-a61d238c3a8e",
   "edge_type": "requires",
   "label": "支撑能力"
  },
  {
   "id": "f8c59b0b-581e-43b5-8119-8c2c45ff0901",
   "source_node_id": "1a2510f8-59cc-4781-ac7c-30278edbbdd4",
   "target_node_id": "9d0f563b-a0c7-4d49-bc5d-a61d238c3a8e",
   "edge_type": "requires",
   "label": "支撑能力"
  },
  {
   "id": "93a201e9-7253-4f6a-8771-5d2d897ae6bb",
   "source_node_id": "d7ec020b-b6b5-4fbb-a0b1-54e296e06876",
   "target_node_id": "9d0f563b-a0c7-4d49-bc5d-a61d238c3a8e",
   "edge_type": "requires",
   "label": "支撑能力"
  },
  {
   "id": "0b946208-a995-4508-a055-56e945f3a618",
   "source_node_id": "2e7f9afc-51c4-499b-9c7e-da6b95991f04",
   "target_node_id": "9d0f563b-a0c7-4d49-bc5d-a61d238c3a8e",
   "edge_type": "requires",
   "label": "支撑能力"
  },
  {
   "id": "dee985ae-3d7a-44d1-96f9-9534ff386cdd",
   "source_node_id": "9aa1dd2e-93e2-4304-af99-eca50c382775",
   "target_node_id": "9d0f563b-a0c7-4d49-bc5d-a61d238c3a8e",
   "edge_type": "requires",
   "label": "支撑能力"
  },
  {
   "id": "3883a948-26ee-4274-8e09-5f312b0c7e6b",
   "source_node_id": "648dfad3-4a0b-4f23-9910-5bca32dbe955",
   "target_node_id": "9d0f563b-a0c7-4d49-bc5d-a61d238c3a8e",
   "edge_type": "requires",
   "label": "支撑能力"
  }
 ],
 "progress": [
  {
   "node_id": "733f0ac2-5a0d-409a-aaf6-980c6180448c",
   "status": "mastered",
   "evidence": ""
  },
  {
   "node_id": "a489a8a5-60b0-421d-b961-d2c333c89d48",
   "status": "completed",
   "evidence": ""
  },
  {
   "node_id": "553f1af2-7c28-43e3-9fe5-c1b2b5af93b7",
   "status": "completed",
   "evidence": ""
  },
  {
   "node_id": "fc501705-d7b5-4a72-bbd6-a17d31862450",
   "status": "completed",
   "evidence": ""
  },
  {
   "node_id": "7305a41d-1a7f-4cbe-aab0-db66e48f7a73",
   "status": "completed",
   "evidence": ""
  },
  {
   "node_id": "b8c696d2-eb90-4462-a67c-46cb5e9271fd",
   "status": "completed",
   "evidence": ""
  },
  {
   "node_id": "bd92e618-db3f-486d-8668-cdca815c0af3",
   "status": "completed",
   "evidence": ""
  },
  {
   "node_id": "b9af692b-da07-40e5-a7fd-ab13d5af4838",
   "status": "completed",
   "evidence": ""
  },
  {
   "node_id": "d3f2ac22-57b5-4643-a647-9f1a5f0a36ba",
   "status": "completed",
   "evidence": ""
  },
  {
   "node_id": "2a639942-cba2-4931-b3a1-d6e5734621a2",
   "status": "completed",
   "evidence": ""
  },
  {
   "node_id": "9f3c356a-05a8-4bdf-90e4-d260721451cf",
   "status": "completed",
   "evidence": ""
  },
  {
   "node_id": "dd6fcc43-af99-44ac-b3c9-d389e101ff61",
   "status": "completed",
   "evidence": ""
  },
  {
   "node_id": "c6e9be5e-ba1d-4d07-aeb1-92de85a1c58e",
   "status": "completed",
   "evidence": ""
  },
  {
   "node_id": "bc4df4b4-7cdf-41dd-8d3e-656bd47df8b4",
   "status": "completed",
   "evidence": ""
  },
  {
   "node_id": "0194790d-0689-4665-a4fb-b882e33e5a87",
   "status": "completed",
   "evidence": ""
  },
  {
   "node_id": "c5dd4d67-9089-409c-a38a-11a55d79ec51",
   "status": "completed",
   "evidence": ""
  },
  {
   "node_id": "0acc2273-60b8-4d70-b3c2-7d6d66f78385",
   "status": "completed",
   "evidence": ""
  },
  {
   "node_id": "056e06aa-8631-4e9b-877a-fb190a3c6323",
   "status": "completed",
   "evidence": ""
  },
  {
   "node_id": "5e96d7a5-4c15-48b7-83a6-cc4075df5f34",
   "status": "completed",
   "evidence": ""
  },
  {
   "node_id": "3253d579-f0b7-4d31-b524-6070775a37a1",
   "status": "completed",
   "evidence": ""
  },
  {
   "node_id": "18c48cfa-7b5c-4020-9c2c-b77e79a7dbef",
   "status": "completed",
   "evidence": ""
  },
  {
   "node_id": "a017d8e0-924a-4c3d-938f-8c9ebdca6f92",
   "status": "completed",
   "evidence": ""
  },
  {
   "node_id": "b3d38af8-4dbf-4d07-a3bc-96b5992895c0",
   "status": "in_progress",
   "evidence": ""
  },
  {
   "node_id": "ced48831-6fff-409a-8ed9-4389d6bb13b0",
   "status": "not_started",
   "evidence": ""
  },
  {
   "node_id": "bb3cffe2-8924-4584-ba84-a890a09d8c35",
   "status": "not_started",
   "evidence": ""
  },
  {
   "node_id": "901ccee3-3493-4256-bd1e-92a752ec7501",
   "status": "not_started",
   "evidence": ""
  },
  {
   "node_id": "366f9417-f6dd-475e-a3dc-1321a8ca5615",
   "status": "not_started",
   "evidence": ""
  },
  {
   "node_id": "640b80be-c1b8-4575-a1e3-e265a58e2a97",
   "status": "not_started",
   "evidence": ""
  },
  {
   "node_id": "ebb592f5-81e0-403f-8922-a0edbb258d1c",
   "status": "not_started",
   "evidence": ""
  },
  {
   "node_id": "56d55022-f1f4-4b49-8afc-e27ca2dad6e9",
   "status": "not_started",
   "evidence": ""
  },
  {
   "node_id": "f3200ee6-d3ab-4849-bbcb-ed6954c65b0f",
   "status": "not_started",
   "evidence": ""
  },
  {
   "node_id": "f5232c8c-c342-44d3-a56c-1926c7ac0ff8",
   "status": "not_started",
   "evidence": ""
  },
  {
   "node_id": "d95e6e50-a6db-4d88-9706-c00fb276fbcb",
   "status": "not_started",
   "evidence": ""
  },
  {
   "node_id": "994dc725-0d10-4f0a-94a1-d059e967496c",
   "status": "not_started",
   "evidence": ""
  },
  {
   "node_id": "3dbc4f38-22d1-4100-929d-d7ed83f9ad4d",
   "status": "not_started",
   "evidence": ""
  },
  {
   "node_id": "d3136c72-f4c8-453a-9aae-c65747c1265e",
   "status": "not_started",
   "evidence": ""
  },
  {
   "node_id": "af38e816-d01a-4549-964d-e86377211ca9",
   "status": "not_started",
   "evidence": ""
  },
  {
   "node_id": "9aa1dd2e-93e2-4304-af99-eca50c382775",
   "status": "not_started",
   "evidence": ""
  },
  {
   "node_id": "decf25d6-3678-4346-8c12-61cfde63ac53",
   "status": "not_started",
   "evidence": ""
  },
  {
   "node_id": "3d8dbd34-0ee1-4e4c-aceb-1225d3247110",
   "status": "not_started",
   "evidence": ""
  },
  {
   "node_id": "ba297c75-e891-4042-a6d9-a3e9eefa3b1a",
   "status": "not_started",
   "evidence": ""
  },
  {
   "node_id": "7f6cc719-2108-4f50-83b7-6e80840830fd",
   "status": "not_started",
   "evidence": ""
  },
  {
   "node_id": "919f5095-a87f-4419-849b-af9c7d14a837",
   "status": "not_started",
   "evidence": ""
  },
  {
   "node_id": "172a8c43-e1eb-406b-941d-9b3a28cfe470",
   "status": "not_started",
   "evidence": ""
  },
  {
   "node_id": "fe35e499-b99d-4a81-9698-041f75a32c8a",
   "status": "not_started",
   "evidence": ""
  },
  {
   "node_id": "ac66a022-b873-46c9-bd81-cc74fcf58117",
   "status": "not_started",
   "evidence": ""
  },
  {
   "node_id": "3a63d4b5-15fc-4fc4-b6f7-deacabb8828a",
   "status": "not_started",
   "evidence": ""
  },
  {
   "node_id": "f61865b8-07cf-4ead-8e0a-c14ab61aaee3",
   "status": "not_started",
   "evidence": ""
  },
  {
   "node_id": "b6dec9d7-cb95-4f3c-b12a-1c01bbe71b82",
   "status": "not_started",
   "evidence": ""
  },
  {
   "node_id": "34a4b130-5ed5-4cb1-a36c-d6ce73654628",
   "status": "not_started",
   "evidence": ""
  },
  {
   "node_id": "6ce1a409-bb5a-4e74-bf27-bdb3dcd66e91",
   "status": "not_started",
   "evidence": ""
  },
  {
   "node_id": "053ee5cb-d56f-4bed-93a1-2406d510144d",
   "status": "not_started",
   "evidence": ""
  },
  {
   "node_id": "648dfad3-4a0b-4f23-9910-5bca32dbe955",
   "status": "not_started",
   "evidence": ""
  },
  {
   "node_id": "8ecdef36-a45e-42be-8aa8-874ce486a9cd",
   "status": "not_started",
   "evidence": ""
  },
  {
   "node_id": "9b680e50-fb59-4719-a1fe-c0063c4fba7f",
   "status": "not_started",
   "evidence": ""
  },
  {
   "node_id": "458c56a8-9d3b-4d27-ae16-6770939890ba",
   "status": "not_started",
   "evidence": ""
  },
  {
   "node_id": "1a2510f8-59cc-4781-ac7c-30278edbbdd4",
   "status": "not_started",
   "evidence": ""
  },
  {
   "node_id": "4da4a3b0-dc3b-473f-bb74-123792e5d36e",
   "status": "not_started",
   "evidence": ""
  },
  {
   "node_id": "fad625b3-ad84-4e21-a970-6d4ff0770cc8",
   "status": "not_started",
   "evidence": ""
  },
  {
   "node_id": "3276c931-cf7a-469e-a52d-9549ccf01819",
   "status": "mastered",
   "evidence": ""
  },
  {
   "node_id": "ff472852-abf0-4c46-97a1-23ff8fad686b",
   "status": "not_started",
   "evidence": ""
  },
  {
   "node_id": "6ef7c184-5fe7-4de6-bddf-1807d2a9afd1",
   "status": "not_started",
   "evidence": ""
  },
  {
   "node_id": "e9431600-540c-4d6c-abf4-beb041d8e132",
   "status": "not_started",
   "evidence": ""
  },
  {
   "node_id": "9396dd36-85c1-4238-a573-ebf763b6ffdd",
   "status": "not_started",
   "evidence": ""
  },
  {
   "node_id": "d7ec020b-b6b5-4fbb-a0b1-54e296e06876",
   "status": "not_started",
   "evidence": ""
  },
  {
   "node_id": "26c63236-ac4c-4958-88ae-f1472ec24a23",
   "status": "not_started",
   "evidence": ""
  },
  {
   "node_id": "fd49554d-1307-4351-8dcb-93b01e66de67",
   "status": "not_started",
   "evidence": ""
  },
  {
   "node_id": "8022a5d7-cf57-43c3-97ad-7b58cd0d837c",
   "status": "not_started",
   "evidence": ""
  },
  {
   "node_id": "e3fbf1fc-e021-469a-bab7-6296461a528b",
   "status": "not_started",
   "evidence": ""
  },
  {
   "node_id": "38f1f5db-4545-4a94-969d-d058da472827",
   "status": "not_started",
   "evidence": ""
  },
  {
   "node_id": "9f6a8605-5e00-4b89-99ea-0ef566f4d1ae",
   "status": "not_started",
   "evidence": ""
  },
  {
   "node_id": "feec11df-1cea-4555-9f42-e609ee04458b",
   "status": "not_started",
   "evidence": ""
  },
  {
   "node_id": "3561dfc1-d964-432b-b753-6fd96e808bb8",
   "status": "not_started",
   "evidence": ""
  },
  {
   "node_id": "2e7f9afc-51c4-499b-9c7e-da6b95991f04",
   "status": "not_started",
   "evidence": ""
  },
  {
   "node_id": "3733cc5d-2799-4840-8695-7caedb44689c",
   "status": "not_started",
   "evidence": ""
  },
  {
   "node_id": "8c205814-b523-429b-b297-f636abd44f06",
   "status": "not_started",
   "evidence": ""
  },
  {
   "node_id": "0abf4fff-3741-40f6-87c9-c3b49fa95130",
   "status": "not_started",
   "evidence": ""
  },
  {
   "node_id": "0307ea0f-0779-4355-a4e7-b9f9d40e111a",
   "status": "not_started",
   "evidence": ""
  },
  {
   "node_id": "9d0f563b-a0c7-4d49-bc5d-a61d238c3a8e",
   "status": "not_started",
   "evidence": ""
  }
 ]
};
