# AI Model Specifications & Usage Strategy (2026-03-18 Update)

Based on current technical benchmarks and user-provided API limits, this document outlines the capabilities of the models integrated into the EchoOrder system.

## 🤖 Model Profiles

### 1. Gemma 3 27B (The Receptionist)
- **Status**: Open-Weights Multimodal Model (Released March 2025).
- **Daily Quota**: **14,400 Requests/Day**.
- **Context Window**: 128,000 Tokens.
- **Strengths**: High-speed text and image reasoning, Elo 1338 (Llama-405B class performance).
- **Role**: Handles routine FB Messenger Q&A, simple order triage (e.g., "A+1"), and general assistance.
- **Cost Efficiency**: High-volume throughput with low latency.

### 2. Gemini 3.1 Pro (The Executive)
- **Status**: Proprietary Multimodal Agentic Model (Released Feb 2026).
- **Daily Quota**: **500 Requests/Day** (User Tier).
- **Context Window**: 1,048,576 Tokens (1M+).
- **Strengths**: Complex reasoning, long-context retrieval, software engineering optimization, agentic workflow support.
- **Role**: Reserved for complex document parsing (Maps, handwritten lists), high-stakes order verification, and advanced image analysis.
- **Thinking Level**: Supports "MEDIUM" thinking_level parameter for cost/performance balance.

## 🚀 Optimized Routing Strategy

To minimize human labor and maximize reliability, the backend implements a **Tiered Routing System**:

1.  **Level 1 (Direct)**: Standard Regex for simple "Code+Quantity" (0 cost).
2.  **Level 2 (Receptionist)**: Gemma 3 27B handles natural language queries and simple order intent.
3.  **Level 3 (Executive)**: Escalation to Gemini 3.1 only for complex inputs or when high-confidence extraction fails at Level 2.

---
*Last Updated: 2026-03-18*
*Recorded in sync_brain for persistent context.*
