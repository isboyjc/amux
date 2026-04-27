# CLI Code Switch V2

## 概述

CLI Code Switch V2 是新一代的 CLI 供应商切换系统，支持多 CLI 独立管理、热切换、历史映射记忆等高级特性。

## 组件结构

```
cli-code-switch-v2/
├── index.tsx                    # 主页面（Tab 切换）
├── cli-config-panel.tsx         # 单个 CLI 配置面板
├── provider-selector-v2.tsx     # 供应商选择器
├── model-mapping-editor-v2.tsx  # 模型映射编辑器
└── README.md                    # 本文档
```

## 核心功能

### 1. CLI 选择器
- Tab 切换 Claude Code 和 Codex
- 每个 CLI 独立配置和管理

### 2. 独立开关
- 每个 CLI 有独立的启用/禁用开关
- 启用前自动检测配置文件
- 自动备份和恢复原始配置

### 3. 供应商选择
- 从现有供应商列表中选择
- 自动加载供应商的模型列表
- 支持动态切换供应商

### 4. 模型映射
支持四种映射类型：
- **Reasoning**: 推理模型映射（检测 thinking、effort 参数）
- **Exact**: 精确模型名称映射
- **Family**: 模型家族映射（通过关键词匹配）
- **Default**: 默认兜底模型

### 5. 热切换
- Claude Code 支持热切换（<0.1s）
- Codex 需要重启（待验证）
- 实时状态徽章显示

### 6. 历史映射
- 记住每个 CLI-Provider 组合的映射配置
- 切换回之前的供应商时自动恢复映射

## 路由

访问路径: `/cli-code-switch-v2`

## IPC 通道

- `cli-cs:get-config` - 获取配置
- `cli-cs:toggle` - 启用/禁用
- `cli-cs:switch-provider` - 切换供应商
- `cli-cs:update-mappings` - 更新模型映射
- `cli-cs:get-historical-mappings` - 获取历史映射
- `cli-cs:detect-config` - 检测配置文件
- `cli-cs:get-providers` - 获取供应商列表
- `cli-cs:get-provider-models` - 获取供应商模型列表

## 与 V1 的区别

| 特性 | V1 | V2 |
|------|-----|-----|
| CLI 支持 | 仅 Claude Code | Claude Code + Codex |
| 配置方式 | 单一配置 | 多 CLI 独立配置 |
| 历史映射 | ✗ | ✓ |
| 热切换 | ✗ | ✓ (Claude Code) |
| 数据库 | 2 张表 | 3 张表 |
| 代理接入 | 可选 | 始终启用 |

## 迁移说明

V1 和 V2 可以共存，互不干扰：
- V1 路由: `/code-switch`
- V2 路由: `/cli-code-switch-v2`
- V1 数据库表: `code_switch_configs`, `code_model_mappings`
- V2 数据库表: `cli_code_switch_configs`, `cli_provider_model_mappings`, `cli_live_config_backups`

## 技术栈

- React 18
- TypeScript
- shadcn/ui (Tabs, Switch, Select, Alert, Badge)
- Sonner (Toast notifications)
- Lucide React (Icons)
