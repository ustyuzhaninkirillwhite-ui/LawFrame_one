# Stage 18 AI Route Policy

| Route | Provider | Model | Status | Purpose |
|---|---|---|---|---|
| `default_chat` | `cometapi` | `deepseek-v4-flash` | enabled | general backend-routed chat foundation |
| `agent_general` | `cometapi` | `deepseek-v4-flash` | enabled | canvas/general structured agent tasks |
| `rag_legal_summary` | `cometapi` | `deepseek-v4-flash` | enabled | RAG summaries; tool calls disabled by default |
| `automation_planner_high` | `openai` | `gpt-5.5` | disabled | Stage 20 reserve only |

Ordinary lawyer UI does not expose a mandatory provider/model selector.
