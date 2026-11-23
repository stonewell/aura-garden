# AGENTS.md

AuraGarden 项目的协作规范。所有参与开发的人和 AI 代理都必须遵守。

## 文档职责(各信息只能写入指定位置)

| 内容 | 位置 | 规则 |
|---|---|---|
| 游戏描述、功能、特性 | `README.md` | 任何游戏相关的描述、功能、特性变化,都必须更新 README |
| 设计改动、核心技术说明 | `docs/design.md` | 只能写入该文件,不得散落到其他文档 |
| 开发任务 | `docs/development_plan.md` | 开发前必须先把任务写入该文件,且只能写在这里 |
| 任务状态 | `docs/development_plan.md` | 状态变化(待办/进行中/完成/阻塞)必须及时更新 |
| 版本更新 | `docs/versions.md` | 每次版本更新都必须记录 |

## 开发计划只追加

`docs/development_plan.md` 采用只追加(append-only)规则:

- 不得删除任何已有任务,也不得改写已有任务的标题或编号。
- 已有任务只允许更新「状态」和「备注」两列,用来记录进展、阻塞原因或作废原因。
- 任务取消时,状态标为"作废"并在备注写明原因,不得删除该行。
- 新任务、新阶段一律追加到文件末尾,编号顺延。
- 任务范围或方案变化时,追加新任务,并在旧任务备注里引用新任务编号。

## 工作流程

1. 先在 `docs/development_plan.md` 登记任务(状态:待办)。
2. 开始做时改为"进行中";完成或阻塞时立即更新。
3. 涉及设计或核心技术变化,更新 `docs/design.md`。
4. 涉及玩家可见的功能/特性变化,更新 `README.md`。
5. 发布新版本时在 `docs/versions.md` 追加记录。

## 代码约定

- 技术栈:Vite + TypeScript(strict)+ Three.js。
- 目录:`src/services`(定位/分析/天气,接口 + 实现)、`src/sim`(物种与生长模拟,纯函数)、`src/scene`(3D 渲染)、`src/main.ts`(UI 与流程)。
- 真实服务通过替换 `main.ts` 顶部的 `analyzer` / `weatherProvider` 接入,不改动调用方。
- 提交前运行 `npm run typecheck`。
