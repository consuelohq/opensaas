# Research: AI Prompt Router for Different Request Types

**Task:** consuelo_on_call_coaching-wp5
**Date:** 2026-01-03
**Status:** Research Complete → Planning

---

## Executive Summary

The Consuelo application currently has **4 distinct AI request types** using Groq API, each with hardcoded prompts embedded in request handlers:

1. **Sales Coaching** - Real-time tips during calls (every 20-30s)
2. **Chat/Underwriting** - Q&A with RAG (user-initiated)
3. **Call Analytics** - Post-call performance review
4. **CSV Mapping** - Intelligent field mapping

**Current Issues:**
- Prompts scattered across 3,300+ line `script.py` and multiple blueprint files
- No centralized prompt management or versioning
- Hard to test, optimize, or A/B test prompts
- Different temperature/token settings mixed with business logic
- Inconsistent error handling and logging

**Solution:**
Build a centralized **Prompt Router** that:
- Classifies request types
- Selects appropriate prompts/templates
- Configures Groq API parameters (temp, max_tokens, model)
- Handles response parsing (JSON, Pydantic, streaming)
- Enables prompt versioning and A/B testing

---

## Current Architecture Analysis

### Request Type Details

| Type | Endpoint | Frequency | Context | Response | Model Params |
|------|----------|-----------|---------|----------|--------------|
| **Sales Coaching** | `GET /sales_tips` | Every 20-30s during call | Last 5 turns + 2 context chunks | `SalesCoaching` Pydantic | temp=0.4, max_tokens=1000 |
| **Chat v2** | `POST /api/chat/v2/send_message` | User-initiated | Full history + RAG docs + transcript | Streaming JSON | temp=0.3, max_tokens=2000 |
| **Call Analytics** | `POST /api/analytics/<call_sid>/generate` | Per-call (manual/auto) | Full transcript | `CallAnalytics` JSON→Pydantic | temp=0.3, max_tokens=1500 |
| **CSV Mapping** | `POST /api/contacts/analyze-csv` | Per upload | Headers + sample rows | JSON mappings | temp=0.1, max_tokens=1000 |

### Key Files & Line Numbers

1. **Sales Coaching:** `app/script.py:3760-3852`
   - Function: `generate_contextual_coaching()`
   - Prompt: Embedded in function (lines 3770-3785)
   - Response: Pydantic `SalesCoaching` model
   - Storage: Redis + MongoDB

2. **Chat/Underwriting:** `app/langgraph_chat.py:299-407`
   - Function: `_build_system_prompt()` + `_generate_response_node()`
   - Prompt: Built dynamically with transcript + RAG context
   - Routing: Keyword-based in `_classify_query_node()` (lines 174-217)
   - Response: Streaming SSE

3. **Call Analytics:** `app/script.py:3854-4000`
   - Function: `generate_call_analytics()`
   - Prompt: Embedded (lines 3877-3916)
   - Response: JSON parsed into `CallAnalytics` Pydantic

4. **CSV Mapping:** `app/script.py:13992-14130`
   - Function: `analyze_csv_mapping()`
   - Prompt: Embedded (lines 14036-14068)
   - Response: JSON with mappings

### Existing Routing Patterns

**LangGraph Routing (Chat only):**
- Location: `langgraph_chat.py:174-217`
- Method: Keyword-based classification
- Categories: `policy_analysis`, `underwriting_question`, `general`
- Routes to RAG or direct generation
- **Limitation:** Only applies to chat, hardcoded keywords

**Blueprint Routing:**
- Flask blueprints: `chat_bp` (v1), `chat_v2_bp` (v2)
- Mostly URL-based, not prompt-based

---

## Prompt Router Design

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│               REQUEST ENTERS BACKEND                         │
│    (GET /sales_tips, POST /api/chat/v2/send_message, etc)    │
└──────────────────────────────────────────────────────────────┘
                           │
                    ▼ (NEW) Entry Point
┌──────────────────────────────────────────────────────────────┐
│          PROMPT ROUTER (app/prompts/prompt_router.py)        │
│                                                               │
│  1. classify_request(endpoint, params, context)              │
│     → Returns: RequestType enum                              │
│                                                               │
│  2. get_prompt_config(request_type, **kwargs)                │
│     → Returns: PromptConfig(template, vars, params)          │
│                                                               │
│  3. build_messages(config, context_data)                     │
│     → Returns: List[Message] for Groq API                    │
│                                                               │
│  4. call_groq_api(messages, params, streaming)               │
│     → Returns: Response (parsed or streaming)                │
└──────────────────────────────────────────────────────────────┘
                           │
        ┌──────────────────┼──────────────────┐
        ▼                  ▼                  ▼
   [Coaching]          [Chat]            [Analytics]
   Pydantic           Streaming            JSON
```

### File Structure

```
/app/prompts/                      [NEW DIRECTORY]
├── __init__.py                    # Export main functions
├── prompt_router.py               # Main router logic
├── request_types.py               # Enums and type definitions
├── prompt_configs.py              # Prompt configuration models
├── templates/                     # Prompt templates
│   ├── __init__.py
│   ├── coaching.py                # Sales coaching prompts
│   ├── chat.py                    # Chat/underwriting prompts
│   ├── analytics.py               # Call analytics prompts
│   └── csv_mapping.py             # CSV mapping prompts
├── groq_client.py                 # Unified Groq API wrapper
└── utils.py                       # Helper functions
```

### Core Data Models

**RequestType Enum:**
```python
from enum import Enum

class RequestType(Enum):
    SALES_COACHING = "sales_coaching"
    CHAT_UNDERWRITING = "chat_underwriting"
    CALL_ANALYTICS = "call_analytics"
    CSV_MAPPING = "csv_mapping"
```

**PromptConfig:**
```python
from dataclasses import dataclass
from typing import List, Dict, Any, Optional

@dataclass
class PromptConfig:
    """Configuration for a prompt request"""
    request_type: RequestType
    system_message: str
    user_message_template: str
    template_vars: Dict[str, Any]

    # Groq API parameters
    model: str = "deepseek-r1-distill-llama-70b"
    temperature: float = 0.3
    max_tokens: int = 1500

    # Response handling
    streaming: bool = False
    response_format: str = "json"  # json, pydantic, text, stream
    pydantic_model: Optional[type] = None

    # Additional flags
    requires_rag: bool = False
    enable_thinking: bool = False
```

**RouterRequest:**
```python
@dataclass
class RouterRequest:
    """Input to the prompt router"""
    request_type: RequestType
    context_data: Dict[str, Any]
    user_id: str
    endpoint: str
    metadata: Optional[Dict[str, Any]] = None
```

### Implementation Plan

#### Phase 1: Core Router (High Priority)
**Files to create:**
1. `app/prompts/__init__.py`
2. `app/prompts/request_types.py`
3. `app/prompts/prompt_configs.py`
4. `app/prompts/prompt_router.py`
5. `app/prompts/groq_client.py`

**Key functions:**
- `classify_request()` - Determine request type from endpoint/context
- `get_prompt_config()` - Load configuration for request type
- `build_groq_messages()` - Assemble message payload
- `call_groq_with_config()` - Execute Groq API call with config

#### Phase 2: Prompt Templates (Medium Priority)
**Files to create:**
1. `app/prompts/templates/__init__.py`
2. `app/prompts/templates/coaching.py`
3. `app/prompts/templates/chat.py`
4. `app/prompts/templates/analytics.py`
5. `app/prompts/templates/csv_mapping.py`

**Extract from:**
- Coaching: `script.py:3770-3785`
- Chat: `langgraph_chat.py:299-350`
- Analytics: `script.py:3877-3916`
- CSV: `script.py:14036-14068`

#### Phase 3: Integration (High Priority)
**Files to modify:**
1. `app/script.py` - Update coaching and analytics functions
2. `app/langgraph_chat.py` - Update system prompt building
3. `app/chat_routes_v2.py` - Use router for chat requests

**Integration pattern:**
```python
# Before
prompt = f"You are a sales coach..."
response = client.chat.completions.create(...)

# After
from prompts.prompt_router import route_prompt_request
from prompts.request_types import RequestType

request = RouterRequest(
    request_type=RequestType.SALES_COACHING,
    context_data={'conversation': conv, 'context': ctx},
    user_id=user_id,
    endpoint='/sales_tips'
)
response = route_prompt_request(request)
```

#### Phase 4: Testing & Optimization (Medium Priority)
**Files to create:**
1. `app/test_prompt_router.py` - Unit tests
2. `e2e/tests/agent/prompt-router.spec.ts` - E2E tests (optional)

**Test cases:**
- Correct request type classification
- Prompt template variable substitution
- Groq API parameter configuration
- Response parsing for each type
- Error handling and fallbacks

---

## Implementation Steps (Detailed)

### Step 1: Create Core Router Structure
**Estimate:** 1-2 hours

1. Create `app/prompts/` directory
2. Implement `request_types.py` with enums
3. Implement `prompt_configs.py` with dataclasses
4. Create basic `prompt_router.py` with stub functions
5. Add `__init__.py` to export main functions

### Step 2: Extract Prompt Templates
**Estimate:** 2-3 hours

1. Create `app/prompts/templates/` directory
2. Extract coaching prompt from `script.py:3770-3785`
3. Extract chat prompt from `langgraph_chat.py:299-350`
4. Extract analytics prompt from `script.py:3877-3916`
5. Extract CSV mapping prompt from `script.py:14036-14068`
6. Convert to Jinja2 or f-string templates with named variables

### Step 3: Implement Groq Client Wrapper
**Estimate:** 1-2 hours

1. Create `app/prompts/groq_client.py`
2. Implement unified Groq API wrapper
3. Handle streaming vs non-streaming
4. Add response parsing (JSON, Pydantic, text)
5. Add error handling and retry logic
6. Add logging (logger + Sentry)

### Step 4: Implement Router Logic
**Estimate:** 2-3 hours

1. Implement `classify_request()` in `prompt_router.py`
2. Implement `get_prompt_config()` - load template + params
3. Implement `build_groq_messages()` - assemble payload
4. Implement `route_prompt_request()` - main entry point
5. Add validation and error handling

### Step 5: Integrate with Sales Coaching
**Estimate:** 1-2 hours

1. Update `generate_contextual_coaching()` in `script.py`
2. Replace hardcoded prompt with router call
3. Test with active call simulation
4. Verify Pydantic response parsing
5. Ensure Redis/MongoDB storage still works

### Step 6: Integrate with Chat/Underwriting
**Estimate:** 2-3 hours

1. Update `_build_system_prompt()` in `langgraph_chat.py`
2. Update `_generate_response_node()` to use router
3. Preserve streaming functionality
4. Test with chat v2 endpoint
5. Verify RAG integration still works

### Step 7: Integrate with Call Analytics
**Estimate:** 1 hour

1. Update `generate_call_analytics()` in `script.py`
2. Replace hardcoded prompt with router call
3. Test with transcript data
4. Verify JSON → Pydantic parsing

### Step 8: Integrate with CSV Mapping
**Estimate:** 1 hour

1. Update `analyze_csv_mapping()` in `script.py`
2. Replace hardcoded prompt with router call
3. Test with CSV upload
4. Verify JSON response parsing

### Step 9: Add Tests
**Estimate:** 2-3 hours

1. Create `app/test_prompt_router.py`
2. Write unit tests for each request type
3. Test prompt template rendering
4. Test Groq API parameter configuration
5. Test response parsing
6. Mock Groq API for tests

### Step 10: Documentation & Cleanup
**Estimate:** 1 hour

1. Update CLAUDE.md with router architecture
2. Add docstrings to all router functions
3. Add type hints
4. Remove old commented-out code
5. Update import statements

---

## Risk Assessment

### High Risk
- **Breaking streaming responses** in chat v2
  - Mitigation: Preserve streaming flag, test thoroughly
- **Breaking Pydantic response parsing** in coaching/analytics
  - Mitigation: Keep existing parsing logic, wrap with router

### Medium Risk
- **Performance regression** from additional abstraction layer
  - Mitigation: Profile before/after, optimize hot paths
- **Breaking RAG integration** in chat
  - Mitigation: Test RAG search still triggers correctly

### Low Risk
- **Prompt template rendering errors**
  - Mitigation: Validate templates on startup, add tests

---

## Success Criteria

1. ✅ All 4 request types routed through centralized system
2. ✅ No breaking changes to existing endpoints
3. ✅ Prompts extracted to configuration files
4. ✅ Tests pass for all request types
5. ✅ Proper error tracking (logger + Sentry)
6. ✅ Performance is within 10% of current implementation
7. ✅ Documentation updated

---

## Future Enhancements (Out of Scope)

- Prompt versioning (A/B testing)
- Prompt caching (Redis)
- Multi-model support (switch between Groq, OpenAI, etc.)
- Prompt analytics dashboard
- Dynamic prompt optimization based on response quality

---

## File Size Reduction Estimate

**Current:**
- `script.py`: ~3,300 lines (135KB)
- `langgraph_chat.py`: ~500 lines

**After Router:**
- `script.py`: ~2,800 lines (remove ~500 lines of prompts)
- `langgraph_chat.py`: ~450 lines (remove ~50 lines)
- `app/prompts/`: ~800 lines (new code)

**Net:** +300 lines, but much better organized and maintainable

---

## Next Action

Proceed to **PLAN** phase:
1. Review this research document
2. Create detailed implementation plan file
3. Get approval to proceed with implementation
