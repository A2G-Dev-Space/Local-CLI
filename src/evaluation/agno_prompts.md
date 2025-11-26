# Agno Cookbook 예제 코드 생성 프롬프트 (통합 버전)

이 문서는 cookbook 디렉토리의 모든 예제 코드에 대한 초보자용 프롬프트를 포함합니다.
동일한 프롬프트를 가진 케이스들은 하나로 통합되었습니다.
각 프롬프트는 해당 예제 코드를 생성하기 위해 code assistant에게 제공할 수 있는 쿼리입니다.

## 사용 방법

각 프롬프트를 code assistant에게 제공하여 예제 코드가 올바르게 생성되는지 평가할 수 있습니다.

---

## Test Case 1

**프롬프트**: AgentOS를 사용하여 배포 가능한 Agno Agent 만들어줘

**파일 경로** (65개):

- `agent_os/advanced_demo/mcp_demo.py`
- `agent_os/advanced_demo/multiple_knowledge_bases.py`
- `agent_os/agent_with_input_schema.py`
- `agent_os/customize/middleware/extract_content_middleware.py`
- `agent_os/dbs/dynamo_demo.py`
- `agent_os/dbs/firestore_demo.py`
- `agent_os/dbs/gcs_json_demo.py`
- `agent_os/dbs/json_demo.py`
- `agent_os/dbs/singlestore_demo.py`
- `agent_os/dbs/sqlite_demo.py`
- `agent_os/dbs/surreal_db/agents.py`
- `agent_os/dbs/surreal_db/db.py`
- `agent_os/dbs/surreal_db/run.py`
- `agent_os/dbs/surreal_db/teams.py`
- `agent_os/dbs/surreal_db/workflows.py`
- `agent_os/dbs/surreal_demo.py`
- `agent_os/interfaces/a2a/agent_with_tools.py`
- `agent_os/interfaces/a2a/basic.py`
- `agent_os/interfaces/a2a/reasoning_agent.py`
- `agent_os/interfaces/a2a/research_team.py`
- `agent_os/interfaces/a2a/structured_output.py`
- `agent_os/interfaces/agui/agent_with_tools.py`
- `agent_os/interfaces/agui/basic.py`
- `agent_os/interfaces/agui/multiple_instances.py`
- `agent_os/interfaces/agui/reasoning_agent.py`
- `agent_os/interfaces/agui/research_team.py`
- `agent_os/interfaces/agui/structured_output.py`
- `agent_os/interfaces/slack/agent_with_user_memory.py`
- `agent_os/interfaces/slack/basic.py`
- `agent_os/interfaces/slack/multiple_instances.py`
- `agent_os/interfaces/slack/reasoning_agent.py`
- `agent_os/interfaces/whatsapp/agent_with_media.py`
- `agent_os/interfaces/whatsapp/agent_with_user_memory.py`
- `agent_os/interfaces/whatsapp/basic.py`
- `agent_os/interfaces/whatsapp/image_generation_model.py`
- `agent_os/interfaces/whatsapp/image_generation_tools.py`
- `agent_os/interfaces/whatsapp/multiple_instances.py`
- `agent_os/interfaces/whatsapp/reasoning_agent.py`
- `agent_os/mcp_demo/enable_mcp_example.py`
- `agent_os/mcp_demo/mcp_tools_advanced_example.py`
- `agent_os/mcp_demo/mcp_tools_example.py`
- `agent_os/mcp_demo/mcp_tools_existing_lifespan.py`
- `agent_os/mcp_demo/test_client.py`
- `agent_os/team_with_input_schema.py`
- `agent_os/workflow/basic_workflow.py`
- `agent_os/workflow/basic_workflow_team.py`
- `agent_os/workflow/customer_research_workflow_parallel.py`
- `agent_os/workflow/workflow_with_conditional.py`
- `agent_os/workflow/workflow_with_custom_function_stream.py`
- `agent_os/workflow/workflow_with_custom_function_updating_session_state.py`
- `agent_os/workflow/workflow_with_history.py`
- `agent_os/workflow/workflow_with_input_schema.py`
- `agent_os/workflow/workflow_with_loop.py`
- `agent_os/workflow/workflow_with_parallel.py`
- `agent_os/workflow/workflow_with_parallel_and_custom_function_step_stream.py`
- `agent_os/workflow/workflow_with_router.py`
- `agent_os/workflow/workflow_with_steps.py`
- `demo/agno_knowledge_agent.py`
- `demo/agno_mcp_agent.py`
- `demo/run.py`
- `demo/simple_agent.py`
- `examples/agents/finance_agent_with_memory.py`
- `examples/workflows/notion_knowledge_manager/notion_manager.py`
- `tools/mcp/mcp_toolbox_demo/agent_os.py`
- `tools/parallel_tools.py`

---

## Test Case 2

**프롬프트**: Agentic RAG를 사용하는 Agno Agent 만들어줘

**파일 경로** (10개):

- `agents/agentic_search/lightrag/agentic_rag_with_lightrag.py`
- `agents/rag/agentic_rag_lancedb.py`
- `agents/rag/agentic_rag_pgvector.py`
- `examples/streamlit_apps/agentic_rag/agentic_rag.py`
- `knowledge/chunking/agentic_chunking.py`
- `knowledge/custom_retriever/async_retriever.py`
- `knowledge/custom_retriever/retriever.py`
- `knowledge/filters/agentic_filtering.py`
- `knowledge/filters/agentic_filtering_with_output_schema.py`
- `knowledge/filters/async_agentic_filtering.py`

---

## Test Case 3

**프롬프트**: Agno 프레임워크를 사용하여 evals 기능을 구현하는 Agent 만들어줘

**파일 경로** (1개):

- `evals/accuracy/accuracy_with_given_answer.py`

---

## Test Case 4

**프롬프트**: Agno 프레임워크를 사용하여 examples 기능을 구현하는 Agent 만들어줘

**파일 경로** (14개):

- `examples/streamlit_apps/agentic_rag/app.py`
- `examples/streamlit_apps/chess_team/app.py`
- `examples/streamlit_apps/deep_researcher/app.py`
- `examples/streamlit_apps/gemini_tutor/app.py`
- `examples/streamlit_apps/geobuddy/app.py`
- `examples/streamlit_apps/github_mcp_agent/app.py`
- `examples/streamlit_apps/github_repo_analyzer/app.py`
- `examples/streamlit_apps/image_generation/app.py`
- `examples/streamlit_apps/llama_tutor/app.py`
- `examples/streamlit_apps/medical_imaging/app.py`
- `examples/streamlit_apps/paperpal/app.py`
- `examples/streamlit_apps/podcast_generator/app.py`
- `examples/streamlit_apps/vision_ai/app.py`
- `examples/workflows/company_description/prompts.py`

---

## Test Case 5

**프롬프트**: Agno 프레임워크를 사용하여 integrations 기능을 구현하는 Agent 만들어줘

**파일 경로** (1개):

- `integrations/a2a/basic_agent/client.py`

---

## Test Case 6

**프롬프트**: Agno 프레임워크를 사용하여 scripts 기능을 구현하는 Agent 만들어줘

**파일 경로** (1개):

- `scripts/cookbook_runner.py`

---

## Test Case 7

**프롬프트**: Aimlapi 모델을 사용하는 Agno Agent 만들어줘

**파일 경로** (1개):

- `models/aimlapi/basic.py`

---

## Test Case 8

**프롬프트**: Anthropic Claude 모델을 사용하는 Agno Agent 만들어줘

**파일 경로** (23개):

- `models/anthropic/basic.py`
- `models/anthropic/basic_with_timeout.py`
- `models/anthropic/betas.py`
- `models/anthropic/pdf_input_bytes.py`
- `models/anthropic/pdf_input_file_upload.py`
- `models/anthropic/pdf_input_local.py`
- `models/anthropic/pdf_input_url.py`
- `models/anthropic/prompt_caching.py`
- `models/anthropic/prompt_caching_extended.py`
- `models/anthropic/skills/agent_with_documents.py`
- `models/anthropic/skills/agent_with_excel.py`
- `models/anthropic/skills/agent_with_powerpoint.py`
- `models/anthropic/skills/file_download_helper.py`
- `models/anthropic/skills/multi_skill_agent.py`
- `models/anthropic/thinking.py`
- `models/aws/claude/basic.py`
- `models/vertexai/claude/basic.py`
- `models/vertexai/claude/basic_with_timeout.py`
- `models/vertexai/claude/betas.py`
- `models/vertexai/claude/pdf_input_bytes.py`
- `models/vertexai/claude/pdf_input_local.py`
- `models/vertexai/claude/prompt_caching.py`
- `models/vertexai/claude/thinking.py`

---

## Test Case 9

**프롬프트**: Anthropic Claude 모델을 사용하는 기본적인 Chat bot Agno Agent 만들어줘

**파일 경로** (1개):

- `examples/agents/basic_agent.py`

---

## Test Case 10

**프롬프트**: Aws 모델을 사용하는 Agno Agent 만들어줘

**파일 경로** (2개):

- `models/aws/bedrock/basic.py`
- `models/aws/bedrock/pdf_agent_bytes.py`

---

## Test Case 11

**프롬프트**: Azure 모델을 사용하는 Agno Agent 만들어줘

**파일 경로** (1개):

- `models/azure/ai_foundry/basic.py`

---

## Test Case 12

**프롬프트**: Cerebras 모델을 사용하는 Agno Agent 만들어줘

**파일 경로** (1개):

- `models/cerebras/basic.py`

---

## Test Case 13

**프롬프트**: Cohere 모델을 사용하는 Agno Agent 만들어줘

**파일 경로** (2개):

- `models/azure/ai_foundry/demo_cohere.py`
- `models/cohere/basic.py`

---

## Test Case 14

**프롬프트**: CometAPI 모델을 사용하는 Agno Agent 만들어줘

**파일 경로** (1개):

- `models/cometapi/basic.py`

---

## Test Case 15

**프롬프트**: Composio tool을 사용하는 Agno Agent 만들어줘

**파일 경로** (1개):

- `tools/composio_tools.py`

---

## Test Case 16

**프롬프트**: Crawl4AI tool을 사용하는 Agno Agent 만들어줘

**파일 경로** (1개):

- `tools/crawl4ai_tools.py`

---

## Test Case 17

**프롬프트**: DashScope 모델을 사용하는 Agno Agent 만들어줘

**파일 경로** (1개):

- `models/dashscope/basic.py`

---

## Test Case 18

**프롬프트**: DeepSeek 모델을 사용하는 Agno Agent 만들어줘

**파일 경로** (2개):

- `models/deepseek/basic.py`
- `models/vllm/code_generation.py`

---

## Test Case 19

**프롬프트**: Deepinfra 모델을 사용하는 Agno Agent 만들어줘

**파일 경로** (1개):

- `models/deepinfra/basic.py`

---

## Test Case 20

**프롬프트**: DuckDuckGo 웹 검색 기능이 있는 Agno Agent 만들어줘

**파일 경로** (168개):

- `agents/async/delay.py`
- `agents/async/gather_agents.py`
- `agents/async/tool_use.py`
- `agents/context_management/location_instructions.py`
- `agents/input_and_output/output_model.py`
- `agents/other/agent_run_metadata.py`
- `agents/other/run_response_events.py`
- `db/firestore/firestore_for_agent.py`
- `db/gcs/gcs_json_for_agent.py`
- `db/json_db/json_for_agent.py`
- `db/redis/redis_for_agent.py`
- `db/singlestore/singlestore_for_agent.py`
- `db/surrealdb/surrealdb_for_agent.py`
- `examples/agents/run_as_cli.py`
- `examples/streamlit_apps/geobuddy/agents.py`
- `examples/workflows/company_description/agents.py`
- `getting_started/02_agent_with_tools.py`
- `getting_started/13_image_agent.py`
- `integrations/observability/atla_op.py`
- `integrations/observability/langfuse_via_openlit.py`
- `integrations/observability/langsmith_via_openinference.py`
- `models/aimlapi/async_tool_use.py`
- `models/aimlapi/tool_use.py`
- `models/anthropic/async_tool_use.py`
- `models/anthropic/context_management.py`
- `models/anthropic/image_input_bytes.py`
- `models/anthropic/image_input_url.py`
- `models/anthropic/tool_use.py`
- `models/anthropic/tool_use_stream.py`
- `models/aws/bedrock/async_tool_use_stream.py`
- `models/aws/bedrock/image_agent_bytes.py`
- `models/aws/bedrock/tool_use.py`
- `models/aws/bedrock/tool_use_stream.py`
- `models/aws/claude/async_tool_use.py`
- `models/aws/claude/image_agent.py`
- `models/aws/claude/tool_use.py`
- `models/aws/claude/tool_use_stream.py`
- `models/azure/ai_foundry/async_tool_use.py`
- `models/azure/ai_foundry/tool_use.py`
- `models/azure/openai/tool_use.py`
- `models/cerebras/async_tool_use.py`
- `models/cerebras/async_tool_use_stream.py`
- `models/cerebras/oss_gpt.py`
- `models/cerebras/tool_use.py`
- `models/cerebras/tool_use_stream.py`
- `models/cerebras_openai/async_tool_use.py`
- `models/cerebras_openai/async_tool_use_stream.py`
- `models/cerebras_openai/oss_gpt.py`
- `models/cerebras_openai/tool_use.py`
- `models/cerebras_openai/tool_use_stream.py`
- `models/cohere/async_tool_use.py`
- `models/cohere/tool_use.py`
- `models/cohere/tool_use_stream.py`
- `models/cometapi/async_tool_use.py`
- `models/cometapi/async_tool_use_stream.py`
- `models/cometapi/tool_use.py`
- `models/cometapi/tool_use_stream.py`
- `models/dashscope/async_image_agent.py`
- `models/dashscope/async_tool_use.py`
- `models/dashscope/image_agent.py`
- `models/dashscope/image_agent_bytes.py`
- `models/dashscope/tool_use.py`
- `models/deepinfra/async_tool_use.py`
- `models/deepinfra/tool_use.py`
- `models/deepseek/async_tool_use.py`
- `models/deepseek/tool_use.py`
- `models/fireworks/async_tool_use.py`
- `models/fireworks/tool_use.py`
- `models/google/gemini/async_tool_use.py`
- `models/google/gemini/image_input.py`
- `models/google/gemini/image_input_file_upload.py`
- `models/google/gemini/tool_use.py`
- `models/google/gemini/tool_use_stream.py`
- `models/groq/async_tool_use.py`
- `models/groq/tool_use.py`
- `models/huggingface/tool_use.py`
- `models/huggingface/tool_use_stream.py`
- `models/ibm/watsonx/async_tool_use.py`
- `models/ibm/watsonx/tool_use.py`
- `models/langdb/web_search.py`
- `models/litellm/async_tool_use.py`
- `models/litellm/image_agent.py`
- `models/litellm/image_agent_bytes.py`
- `models/litellm/tool_use_stream.py`
- `models/litellm_openai/tool_use.py`
- `models/llama_cpp/tool_use.py`
- `models/llama_cpp/tool_use_stream.py`
- `models/lmstudio/tool_use.py`
- `models/lmstudio/tool_use_stream.py`
- `models/meta/llama/image_input_bytes.py`
- `models/meta/llama_openai/image_input_bytes.py`
- `models/mistral/async_structured_output.py`
- `models/mistral/async_tool_use.py`
- `models/mistral/image_file_input_agent.py`
- `models/mistral/mistral_small.py`
- `models/mistral/structured_output.py`
- `models/mistral/structured_output_with_tool_use.py`
- `models/mistral/tool_use.py`
- `models/nebius/async_tool_use.py`
- `models/nebius/async_tool_use_stream.py`
- `models/nebius/tool_use.py`
- `models/nebius/tool_use_stream.py`
- `models/nexus/async_tool_use.py`
- `models/nexus/async_tool_use_stream.py`
- `models/nexus/tool_use.py`
- `models/nexus/tool_use_stream.py`
- `models/nvidia/async_tool_use.py`
- `models/nvidia/tool_use.py`
- `models/nvidia/tool_use_stream.py`
- `models/ollama/tool_use.py`
- `models/ollama/tool_use_stream.py`
- `models/ollama_tools/async_tool_use_stream.py`
- `models/ollama_tools/tool_use.py`
- `models/ollama_tools/tool_use_stream.py`
- `models/openai/chat/async_tool_use.py`
- `models/openai/chat/image_agent.py`
- `models/openai/chat/image_agent_bytes.py`
- `models/openai/chat/image_agent_with_memory.py`
- `models/openai/chat/tool_use.py`
- `models/openai/chat/tool_use_stream.py`
- `models/openai/responses/async_tool_use.py`
- `models/openai/responses/image_agent.py`
- `models/openai/responses/image_agent_bytes.py`
- `models/openai/responses/image_agent_with_memory.py`
- `models/openai/responses/structured_output_with_tools.py`
- `models/openai/responses/tool_use.py`
- `models/openai/responses/tool_use_stream.py`
- `models/openrouter/async_tool_use.py`
- `models/openrouter/tool_use.py`
- `models/portkey/async_tool_use.py`
- `models/portkey/async_tool_use_stream.py`
- `models/portkey/tool_use.py`
- `models/portkey/tool_use_stream.py`
- `models/requesty/async_tool_use.py`
- `models/requesty/tool_use.py`
- `models/siliconflow/tool_use.py`
- `models/together/async_tool_use.py`
- `models/together/tool_use.py`
- `models/together/tool_use_stream.py`
- `models/vercel/async_tool_use.py`
- `models/vercel/image_agent.py`
- `models/vercel/tool_use.py`
- `models/vertexai/claude/async_tool_use.py`
- `models/vertexai/claude/image_input_bytes.py`
- `models/vertexai/claude/image_input_url.py`
- `models/vertexai/claude/tool_use.py`
- `models/vertexai/claude/tool_use_stream.py`
- `models/vllm/async_tool_use.py`
- `models/vllm/tool_use.py`
- `models/vllm/tool_use_stream.py`
- `models/xai/async_tool_use.py`
- `models/xai/image_agent.py`
- `models/xai/image_agent_bytes.py`
- `models/xai/image_agent_with_memory.py`
- `models/xai/tool_use.py`
- `models/xai/tool_use_stream.py`
- `reasoning/models/openai/o3_mini_with_tools.py`
- `reasoning/models/openai/reasoning_effort.py`
- `reasoning/models/openai/reasoning_summary.py`
- `tools/aws_ses_tools.py`
- `tools/duckduckgo_tools.py`
- `tools/multiple_tools.py`
- `tools/other/cache_tool_calls.py`
- `tools/other/include_exclude_tools.py`
- `tools/other/stop_after_tool_call.py`
- `tools/tool_hooks/tool_hook.py`
- `tools/tool_hooks/tool_hook_async.py`
- `tools/webbrowser_tools.py`

---

## Test Case 21

**프롬프트**: E2B tool을 사용하는 Agno Agent 만들어줘

**파일 경로** (1개):

- `tools/e2b_tools.py`

---

## Test Case 22

**프롬프트**: External tool을 사용하는 Agno Agent 만들어줘

**파일 경로** (4개):

- `agents/human_in_the_loop/external_tool_execution.py`
- `agents/human_in_the_loop/external_tool_execution_async.py`
- `agents/human_in_the_loop/external_tool_execution_async_responses.py`
- `agents/human_in_the_loop/external_tool_execution_toolkit.py`

---

## Test Case 23

**프롬프트**: Fireworks 모델을 사용하는 Agno Agent 만들어줘

**파일 경로** (1개):

- `models/fireworks/basic.py`

---

## Test Case 24

**프롬프트**: Github tool을 사용하는 Agno Agent 만들어줘

**파일 경로** (4개):

- `examples/agents/readme_generator.py`
- `examples/streamlit_apps/github_repo_analyzer/agents.py`
- `tools/github_tools.py`
- `tools/mcp/github.py`

---

## Test Case 25

**프롬프트**: Gmail tool을 사용하는 Agno Agent 만들어줘

**파일 경로** (1개):

- `tools/gmail_tools.py`

---

## Test Case 26

**프롬프트**: Google Gemini 모델을 사용하는 Agno Agent 만들어줘

**파일 경로** (10개):

- `models/google/gemini/audio_input_bytes_content.py`
- `models/google/gemini/basic.py`
- `models/google/gemini/search.py`
- `models/google/gemini/text_to_speech.py`
- `models/google/gemini/thinking_agent.py`
- `models/google/gemini/url_context.py`
- `models/google/gemini/url_context_with_search.py`
- `models/google/gemini/video_input_bytes_content.py`
- `models/google/gemini/video_input_local_file_upload.py`
- `models/google/gemini/video_input_youtube.py`

---

## Test Case 27

**프롬프트**: Google Gemini 모델을 사용하는 기본적인 Chat bot Agno Agent 만들어줘

**파일 경로** (1개):

- `agents/multimodal/video_to_shorts.py`

---

## Test Case 28

**프롬프트**: Groq 모델을 사용하는 Agno Agent 만들어줘

**파일 경로** (3개):

- `models/groq/basic.py`
- `models/groq/reasoning/basic.py`
- `models/groq/reasoning/demo_deepseek_qwen.py`

---

## Test Case 29

**프롬프트**: Groq 모델을 사용하는 기본적인 Chat bot Agno Agent 만들어줘

**파일 경로** (1개):

- `reasoning/models/groq/fast_reasoning.py`

---

## Test Case 30

**프롬프트**: Guardrails를 사용하는 안전한 Agno Agent 만들어줘

**파일 경로** (3개):

- `agents/guardrails/openai_moderation.py`
- `agents/guardrails/pii_detection.py`
- `agents/guardrails/prompt_injection.py`

---

## Test Case 31

**프롬프트**: HackerNews에서 정보를 검색하는 Agno Agent 만들어줘

**파일 경로** (6개):

- `agents/input_and_output/input_schema_on_agent.py`
- `agents/input_and_output/input_schema_on_agent_as_typed_dict.py`
- `agents/input_and_output/structured_input.py`
- `agents/input_and_output/structured_input_output_with_parser_model.py`
- `examples/agents/pydantic_model_as_input.py`
- `tools/hackernews_tools.py`

---

## Test Case 32

**프롬프트**: HuggingFace 모델을 사용하는 Agno Agent 만들어줘

**파일 경로** (1개):

- `models/huggingface/llama_essay_writer.py`

---

## Test Case 33

**프롬프트**: IBM 모델을 사용하는 Agno Agent 만들어줘

**파일 경로** (1개):

- `models/ibm/watsonx/basic.py`

---

## Test Case 34

**프롬프트**: Imagen tool을 사용하는 Agno Agent 만들어줘

**파일 경로** (2개):

- `models/google/gemini/imagen_tool.py`
- `models/google/gemini/imagen_tool_advanced.py`

---

## Test Case 35

**프롬프트**: Instantiate Agent With tool을 사용하는 Agno Agent 만들어줘

**파일 경로** (1개):

- `evals/performance/instantiate_agent_with_tool.py`

---

## Test Case 36

**프롬프트**: JinaReader tool을 사용하는 Agno Agent 만들어줘

**파일 경로** (1개):

- `tools/jinareader_tools.py`

---

## Test Case 37

**프롬프트**: Knowledge Base를 활용하는 Agno Agent 만들어줘

**파일 경로** (15개):

- `agents/culture/02_use_cultural_knowledge_in_agent.py`
- `agents/culture/03_automatic_cultural_management.py`
- `agents/culture/04_manually_add_culture.py`
- `agents/culture/05_test_agent_with_culture.py`
- `agents/rag/local_rag_langchain_qdrant.py`
- `db/in_memory/in_memory_storage_for_agent.py`
- `evals/performance/response_with_storage.py`
- `examples/agents/agent_with_storage.py`
- `knowledge/readers/csv_reader.py`
- `knowledge/readers/firecrawl_reader.py`
- `knowledge/readers/json_reader.py`
- `knowledge/readers/tavily_reader.py`
- `knowledge/readers/web_reader.py`
- `models/meta/llama_openai/storage.py`
- `tools/wikipedia_tools.py`

---

## Test Case 38

**프롬프트**: LMStudio 모델을 사용하는 Agno Agent 만들어줘

**파일 경로** (1개):

- `models/lmstudio/basic.py`

---

## Test Case 39

**프롬프트**: LangDB 모델을 사용하는 Agno Agent 만들어줘

**파일 경로** (1개):

- `models/langdb/basic.py`

---

## Test Case 40

**프롬프트**: LiteLLM 모델을 사용하는 Agno Agent 만들어줘

**파일 경로** (2개):

- `models/litellm/basic_gpt.py`
- `models/litellm/pdf_input_bytes.py`

---

## Test Case 41

**프롬프트**: Llama.cpp 모델을 사용하는 Agno Agent 만들어줘

**파일 경로** (1개):

- `models/llama_cpp/basic.py`

---

## Test Case 42

**프롬프트**: Meta 모델을 사용하는 Agno Agent 만들어줘

**파일 경로** (2개):

- `models/meta/llama/basic.py`
- `models/sambanova/basic.py`

---

## Test Case 43

**프롬프트**: Mistral 모델을 사용하는 Agno Agent 만들어줘

**파일 경로** (4개):

- `models/azure/ai_foundry/demo_mistral.py`
- `models/huggingface/basic.py`
- `models/litellm/basic.py`
- `models/mistral/basic.py`

---

## Test Case 44

**프롬프트**: MongoDB 데이터베이스를 사용하는 AgentOS로 배포 가능한 Agno Agent 만들어줘

**파일 경로** (2개):

- `agent_os/dbs/async_mongo_demo.py`
- `agent_os/dbs/mongo_demo.py`

---

## Test Case 45

**프롬프트**: MongoDB 데이터베이스를 사용하는 Agno Agent 만들어줘

**파일 경로** (2개):

- `db/mongo/async_mongo/async_mongodb_for_agent.py`
- `db/mongo/mongodb_for_agent.py`

---

## Test Case 46

**프롬프트**: NVIDIA 모델을 사용하는 Agno Agent 만들어줘

**파일 경로** (1개):

- `models/nvidia/basic.py`

---

## Test Case 47

**프롬프트**: Nebius 모델을 사용하는 Agno Agent 만들어줘

**파일 경로** (1개):

- `models/nebius/basic.py`

---

## Test Case 48

**프롬프트**: Nexus 모델을 사용하는 Agno Agent 만들어줘

**파일 경로** (1개):

- `models/nexus/basic.py`

---

## Test Case 49

**프롬프트**: Ollama 모델을 사용하는 Agno Agent 만들어줘

**파일 경로** (7개):

- `models/ollama/basic.py`
- `models/ollama/demo_deepseek_r1.py`
- `models/ollama/demo_phi4.py`
- `models/ollama/reasoning_agent.py`
- `models/ollama/set_client.py`
- `models/ollama/set_temperature.py`
- `models/ollama_tools/basic.py`

---

## Test Case 50

**프롬프트**: OpenAI 모델을 사용하는 Agno Agent 만들어줘

**파일 경로** (11개):

- `models/azure/openai/basic.py`
- `models/cerebras_openai/basic.py`
- `models/clients/http_client_caching.py`
- `models/cometapi/multi_model.py`
- `models/litellm_openai/basic.py`
- `models/meta/llama_openai/basic.py`
- `models/openai/chat/agent_flex_tier.py`
- `models/openai/chat/basic.py`
- `models/openai/chat/custom_role_map.py`
- `models/openai/responses/agent_flex_tier.py`
- `models/openai/responses/basic.py`

---

## Test Case 51

**프롬프트**: OpenAI 모델을 사용하는 기본적인 Chat bot Agno Agent 만들어줘

**파일 경로** (19개):

- `agents/caching/cache_model_response.py`
- `agents/context_management/datetime_instructions.py`
- `agents/context_management/dynamic_instructions.py`
- `agents/context_management/few_shot_learning.py`
- `agents/context_management/instructions.py`
- `agents/custom_logging/custom_logging.py`
- `agents/custom_logging/log_to_file.py`
- `agents/dependencies/dependencies_functions.py`
- `agents/input_and_output/instructions.py`
- `agents/multimodal/audio_input_output.py`
- `agents/other/agent_extra_metrics.py`
- `agents/other/agent_model_string.py`
- `agents/other/debug.py`
- `evals/performance/comparison/pydantic_ai_instantiation.py`
- `evals/performance/instantiate_agent.py`
- `evals/performance/simple_response.py`
- `getting_started/16_audio_input_output.py`
- `integrations/observability/agent_ops.py`
- `integrations/observability/weave_op.py`

---

## Test Case 52

**프롬프트**: OpenRouter 모델을 사용하는 Agno Agent 만들어줘

**파일 경로** (2개):

- `models/openrouter/basic.py`
- `models/openrouter/dynamic_model_router.py`

---

## Test Case 53

**프롬프트**: Perplexity 모델을 사용하는 Agno Agent 만들어줘

**파일 경로** (2개):

- `models/perplexity/basic.py`
- `models/perplexity/web_search.py`

---

## Test Case 54

**프롬프트**: Portkey 모델을 사용하는 Agno Agent 만들어줘

**파일 경로** (1개):

- `models/portkey/basic.py`

---

## Test Case 55

**프롬프트**: PostgreSQL 데이터베이스를 사용하는 AgentOS로 배포 가능한 Agno Agent 만들어줘

**파일 경로** (33개):

- `agent_os/advanced_demo/_agents.py`
- `agent_os/advanced_demo/_teams.py`
- `agent_os/advanced_demo/demo.py`
- `agent_os/advanced_demo/reasoning_demo.py`
- `agent_os/advanced_demo/teams_demo.py`
- `agent_os/all_interfaces.py`
- `agent_os/basic.py`
- `agent_os/customize/custom_fastapi_app.py`
- `agent_os/customize/custom_health_endpoint.py`
- `agent_os/customize/custom_lifespan.py`
- `agent_os/customize/middleware/agent_os_with_custom_middleware.py`
- `agent_os/customize/middleware/agent_os_with_jwt_middleware.py`
- `agent_os/customize/middleware/agent_os_with_jwt_middleware_cookies.py`
- `agent_os/customize/middleware/custom_fastapi_app_with_jwt_middleware.py`
- `agent_os/customize/override_routes.py`
- `agent_os/dbs/async_postgres_demo.py`
- `agent_os/dbs/neon_demo.py`
- `agent_os/dbs/postgres_demo.py`
- `agent_os/dbs/supabase_demo.py`
- `agent_os/demo.py`
- `agent_os/evals_demo.py`
- `agent_os/guardrails_demo.py`
- `agent_os/handle_custom_events.py`
- `agent_os/interfaces/slack/basic_workflow.py`
- `agent_os/knowledge/agentos_knowledge.py`
- `agent_os/knowledge/agno_docs_agent.py`
- `agent_os/os_config/basic.py`
- `agent_os/os_config/yaml_config.py`
- `agent_os/pass_dependencies_to_agent.py`
- `agent_os/update_from_lifespan.py`
- `agent_os/workflow/basic_chat_workflow_agent.py`
- `agent_os/workflow/workflow_with_custom_function.py`
- `agent_os/workflow/workflow_with_nested_steps.py`

---

## Test Case 56

**프롬프트**: PostgreSQL 데이터베이스를 사용하는 Agno Agent 만들어줘

**파일 경로** (68개):

- `agents/multimodal/02_media_input_to_agent_and_tool.py`
- `agents/other/agent_metrics.py`
- `agents/session/01_persistent_session.py`
- `agents/session/02_persistent_session_history.py`
- `agents/session/03_session_summary.py`
- `agents/session/04_session_summary_references.py`
- `agents/session/05_chat_history.py`
- `agents/session/06_rename_session.py`
- `agents/session/08_cache_session.py`
- `agents/session/11_custom_session_summary_instructions.py`
- `agents/session/12_async_session_summary.py`
- `agents/session/12_chat_history_num_messages.py`
- `agents/state/session_state_in_context.py`
- `db/02_session_summary.py`
- `db/03_chat_history.py`
- `db/postgres/async_postgres/async_postgres_for_agent.py`
- `db/postgres/postgres_for_agent.py`
- `demo/db.py`
- `evals/accuracy/db_logging.py`
- `evals/performance/db_logging.py`
- `evals/reliability/db_logging.py`
- `examples/agents/agent_with_memory.py`
- `examples/streamlit_apps/llama_tutor/agents.py`
- `examples/streamlit_apps/medical_imaging/medical_agent.py`
- `examples/streamlit_apps/paperpal/agents.py`
- `examples/streamlit_apps/podcast_generator/agents.py`
- `examples/streamlit_apps/vision_ai/agents.py`
- `memory/01_agent_with_memory.py`
- `memory/02_agentic_memory.py`
- `memory/03_agents_share_memory.py`
- `memory/04_custom_memory_manager.py`
- `memory/05_multi_user_multi_session_chat.py`
- `memory/06_multi_user_multi_session_chat_concurrent.py`
- `memory/memory_manager/01_standalone_memory.py`
- `memory/memory_manager/02_memory_creation.py`
- `memory/memory_manager/03_custom_memory_instructions.py`
- `memory/memory_manager/04_memory_search.py`
- `models/anthropic/db.py`
- `models/anthropic/memory.py`
- `models/aws/claude/db.py`
- `models/azure/ai_foundry/db.py`
- `models/azure/openai/db.py`
- `models/cerebras/db.py`
- `models/cerebras_openai/db.py`
- `models/cohere/db.py`
- `models/cohere/memory.py`
- `models/google/gemini/db.py`
- `models/groq/db.py`
- `models/ibm/watsonx/db.py`
- `models/lmstudio/db.py`
- `models/lmstudio/memory.py`
- `models/meta/llama/db.py`
- `models/meta/llama/memory.py`
- `models/meta/llama_openai/memory.py`
- `models/mistral/memory.py`
- `models/nebius/db.py`
- `models/ollama/db.py`
- `models/ollama/memory.py`
- `models/ollama_tools/db.py`
- `models/openai/chat/db.py`
- `models/openai/chat/memory.py`
- `models/openai/responses/db.py`
- `models/openai/responses/memory.py`
- `models/openai/responses/pdf_input_url.py`
- `models/perplexity/memory.py`
- `models/vertexai/claude/memory.py`
- `models/vllm/db.py`
- `models/vllm/memory.py`

---

## Test Case 57

**프롬프트**: Redis 데이터베이스를 사용하는 AgentOS로 배포 가능한 Agno Agent 만들어줘

**파일 경로** (1개):

- `agent_os/dbs/redis_demo.py`

---

## Test Case 58

**프롬프트**: Requesty 모델을 사용하는 Agno Agent 만들어줘

**파일 경로** (1개):

- `models/requesty/basic.py`

---

## Test Case 59

**프롬프트**: Reranking 기능이 있는 Agentic RAG를 구현하는 Agno Agent 만들어줘

**파일 경로** (4개):

- `agents/agentic_search/agentic_rag.py`
- `agents/agentic_search/agentic_rag_infinity_reranker.py`
- `agents/agentic_search/agentic_rag_with_reasoning.py`
- `agents/rag/agentic_rag_with_reranking.py`

---

## Test Case 60

**프롬프트**: Retry tool을 사용하는 Agno Agent 만들어줘

**파일 경로** (1개):

- `tools/other/retry_tool_call_from_post_hook.py`

---

## Test Case 61

**프롬프트**: SQLite 데이터베이스를 사용하는 Agno Agent 만들어줘

**파일 경로** (47개):

- `agents/context_management/filter_tool_calls_from_history.py`
- `agents/culture/01_create_cultural_knowledge.py`
- `agents/hooks/session_state_post_hook.py`
- `agents/hooks/session_state_pre_hook.py`
- `agents/human_in_the_loop/confirmation_required.py`
- `agents/human_in_the_loop/confirmation_required_stream.py`
- `agents/human_in_the_loop/confirmation_required_stream_async.py`
- `agents/human_in_the_loop/confirmation_required_with_run_id.py`
- `agents/human_in_the_loop/external_tool_execution_stream.py`
- `agents/human_in_the_loop/external_tool_execution_stream_async.py`
- `agents/human_in_the_loop/user_input_required_stream.py`
- `agents/human_in_the_loop/user_input_required_stream_async.py`
- `agents/multimodal/agent_using_multimodal_tool_response_in_runs.py`
- `agents/multimodal/audio_multi_turn.py`
- `agents/multimodal/audio_sentiment_analysis.py`
- `agents/session/09_disable_storing_history_messages.py`
- `agents/session/10_disable_storing_tool_messages.py`
- `agents/state/agentic_session_state.py`
- `agents/state/last_n_session_messages.py`
- `agents/state/manual_session_state_update.py`
- `agents/state/overwrite_stored_session_state.py`
- `agents/state/session_state_advanced.py`
- `agents/state/session_state_basic.py`
- `agents/state/session_state_in_event.py`
- `agents/state/session_state_multiple_users.py`
- `db/examples/multi_user_multi_session.py`
- `db/examples/selecting_tables.py`
- `db/sqlite/async_sqlite/async_sqlite_for_agent.py`
- `db/sqlite/sqlite_for_agent.py`
- `evals/performance/response_with_memory_updates.py`
- `examples/agents/research_agent.py`
- `getting_started/09_agent_session.py`
- `getting_started/10_user_memories_and_summaries.py`
- `getting_started/14_generate_image.py`
- `integrations/discord/agent_with_user_memory.py`
- `memory/07_share_memory_and_history_between_agents.py`
- `memory/08_memory_tools.py`
- `memory/memory_manager/05_db_tools_control.py`
- `models/cometapi/image_agent_with_memory.py`
- `models/google/gemini/gemini_2_to_3.py`
- `models/google/gemini/gemini_3_pro.py`
- `models/litellm/db.py`
- `models/vertexai/claude/db.py`
- `reasoning/tools/memory_tools.py`
- `tools/file_generation_tools.py`
- `tools/other/retry_tool_call.py`
- `tools/other/session_state_tool.py`

---

## Test Case 62

**프롬프트**: SiliconFlow 모델을 사용하는 Agno Agent 만들어줘

**파일 경로** (1개):

- `models/siliconflow/basic.py`

---

## Test Case 63

**프롬프트**: Stop After tool을 사용하는 Agno Agent 만들어줘

**파일 경로** (1개):

- `tools/tool_decorator/stop_after_tool_call.py`

---

## Test Case 64

**프롬프트**: Tavily 검색 tool을 사용하는 Agno Agent 만들어줘

**파일 경로** (1개):

- `tools/tavily_tools.py`

---

## Test Case 65

**프롬프트**: Together 모델을 사용하는 Agno Agent 만들어줘

**파일 경로** (2개):

- `models/together/basic.py`
- `models/together/reasoning_agent.py`

---

## Test Case 66

**프롬프트**: Trafilatura tool을 사용하는 Agno Agent 만들어줘

**파일 경로** (1개):

- `tools/trafilatura_tools.py`

---

## Test Case 67

**프롬프트**: Vercel 모델을 사용하는 Agno Agent 만들어줘

**파일 경로** (1개):

- `models/vercel/basic.py`

---

## Test Case 68

**프롬프트**: Websearch Builtin tool을 사용하는 Agno Agent 만들어줘

**파일 경로** (1개):

- `models/openai/responses/websearch_builtin_tool.py`

---

## Test Case 69

**프롬프트**: YFinance를 사용하여 주식 정보를 조회할 수 있는 Agno Agent 만들어줘

**파일 경로** (51개):

- `agents/events/basic_agent_events.py`
- `agents/hooks/output_stream_hook_send_notification.py`
- `agents/human_in_the_loop/confirmation_required_toolkit.py`
- `agents/input_and_output/response_as_variable.py`
- `agents/other/debug_level.py`
- `agents/other/intermediate_steps.py`
- `agents/other/tool_call_limit.py`
- `examples/agents/agent_with_instructions.py`
- `examples/agents/agent_with_tools.py`
- `examples/agents/finance_agent.py`
- `integrations/observability/arize_phoenix_via_openinference.py`
- `integrations/observability/arize_phoenix_via_openinference_local.py`
- `integrations/observability/langfuse_via_openinference.py`
- `integrations/observability/langfuse_via_openinference_response_model.py`
- `integrations/observability/langtrace_op.py`
- `integrations/observability/langwatch_op.py`
- `integrations/observability/logfire_via_openinference.py`
- `integrations/observability/opik_via_openinference.py`
- `models/anthropic/financial_analyst_thinking.py`
- `models/groq/metrics.py`
- `models/groq/reasoning/finance_agent.py`
- `models/langdb/agent.py`
- `models/langdb/agent_stream.py`
- `models/langdb/finance_agent.py`
- `models/litellm/metrics.py`
- `models/litellm/tool_use.py`
- `models/meta/llama/async_tool_use.py`
- `models/meta/llama/async_tool_use_stream.py`
- `models/meta/llama/metrics.py`
- `models/meta/llama/tool_use.py`
- `models/meta/llama/tool_use_stream.py`
- `models/meta/llama_openai/async_tool_use.py`
- `models/meta/llama_openai/async_tool_use_stream.py`
- `models/meta/llama_openai/metrics.py`
- `models/meta/llama_openai/tool_use.py`
- `models/meta/llama_openai/tool_use_stream.py`
- `models/ollama/demo_qwen.py`
- `models/openai/chat/metrics.py`
- `models/openai/chat/reasoning_o3_mini.py`
- `models/openai/chat/verbosity_control.py`
- `models/openai/responses/reasoning_o3_mini.py`
- `models/openai/responses/tool_use_gpt_5.py`
- `models/openai/responses/tool_use_o3.py`
- `models/openai/responses/verbosity_control.py`
- `models/xai/finance_agent.py`
- `reasoning/agents/finance_agent.py`
- `reasoning/models/azure_openai/o3_mini_with_tools.py`
- `reasoning/models/deepseek/finance_agent.py`
- `reasoning/models/xai/reasoning_effort.py`
- `tools/mcp/sequential_thinking.py`
- `tools/yfinance_tools.py`

---

## Test Case 70

**프롬프트**: vLLM 모델을 사용하는 Agno Agent 만들어줘

**파일 경로** (1개):

- `models/vllm/basic.py`

---

## Test Case 71

**프롬프트**: xAI 모델을 사용하는 Agno Agent 만들어줘

**파일 경로** (4개):

- `models/google/gemini/vertex_ai_search.py`
- `models/google/gemini/vertexai.py`
- `models/xai/basic.py`
- `models/xai/live_search_agent.py`

---

## Test Case 72

**프롬프트**: 구조화된 출력을 반환하는 Agno Agent 만들어줘

**파일 경로** (58개):

- `agents/async/structured_output.py`
- `agents/hooks/input_validation_pre_hook.py`
- `agents/hooks/output_transformation_post_hook.py`
- `agents/hooks/output_validation_post_hook.py`
- `agents/input_and_output/parser_model.py`
- `agents/input_and_output/parser_model_ollama.py`
- `agents/input_and_output/parser_model_stream.py`
- `agents/multimodal/image_to_structured_output.py`
- `examples/streamlit_apps/mcp_agent/mcp_client.py`
- `examples/workflows/company_analysis/models.py`
- `examples/workflows/customer_support/agents.py`
- `examples/workflows/investment_analyst/models.py`
- `getting_started/05_structured_output.py`
- `models/aimlapi/structured_output.py`
- `models/anthropic/structured_output.py`
- `models/anthropic/structured_output_stream.py`
- `models/aws/bedrock/structured_output.py`
- `models/aws/claude/structured_output.py`
- `models/azure/ai_foundry/structured_output.py`
- `models/azure/openai/structured_output.py`
- `models/cerebras/structured_output.py`
- `models/cerebras_openai/structured_output.py`
- `models/cohere/async_structured_output.py`
- `models/cohere/structured_output.py`
- `models/cometapi/structured_output.py`
- `models/dashscope/structured_output.py`
- `models/deepinfra/json_output.py`
- `models/deepseek/structured_output.py`
- `models/fireworks/structured_output.py`
- `models/google/gemini/structured_output.py`
- `models/google/gemini/structured_output_stream.py`
- `models/groq/structured_output.py`
- `models/ibm/watsonx/structured_output.py`
- `models/langdb/structured_output.py`
- `models/litellm/structured_output.py`
- `models/llama_cpp/structured_output.py`
- `models/lmstudio/structured_output.py`
- `models/meta/llama/structured_output.py`
- `models/meta/llama_openai/structured_output.py`
- `models/mistral/image_ocr_with_structured_output.py`
- `models/nebius/structured_output.py`
- `models/ollama/structured_output.py`
- `models/ollama_tools/structured_output.py`
- `models/openai/chat/async_structured_response_stream.py`
- `models/openai/chat/structured_output.py`
- `models/openai/chat/structured_output_stream.py`
- `models/openai/responses/deep_research_agent.py`
- `models/openai/responses/structured_output.py`
- `models/openrouter/structured_output.py`
- `models/perplexity/structured_output.py`
- `models/portkey/structured_output.py`
- `models/requesty/structured_output.py`
- `models/siliconflow/structured_output.py`
- `models/together/structured_output.py`
- `models/vertexai/claude/structured_output.py`
- `models/vertexai/claude/structured_output_stream.py`
- `models/vllm/structured_output.py`
- `models/xai/structured_output.py`

---

## Test Case 73

**프롬프트**: 대화 기록을 기억하는 Agno Agent 만들어줘

**파일 경로** (36개):

- `agents/multimodal/image_input_multi-turn.py`
- `agents/session/07_in_memory_db.py`
- `agents/state/change_state_on_run.py`
- `db/dynamodb/dynamo_for_agent.py`
- `db/mysql/mysql_for_agent.py`
- `demo/memory_agent.py`
- `examples/chainlit_apps/basic/basic_app.py`
- `examples/streamlit_apps/gemini_tutor/agents.py`
- `integrations/a2a/basic_agent/__main__.py`
- `integrations/discord/agent_with_media.py`
- `integrations/discord/basic.py`
- `integrations/memory/mem0_integration.py`
- `memory/memory_manager/surrealdb/custom_memory_instructions.py`
- `memory/memory_manager/surrealdb/db_tools_control.py`
- `memory/memory_manager/surrealdb/memory_creation.py`
- `memory/memory_manager/surrealdb/memory_search_surreal.py`
- `memory/memory_manager/surrealdb/standalone_memory_surreal.py`
- `models/aimlapi/image_agent_with_memory.py`
- `models/google/gemini/async_image_generation.py`
- `models/google/gemini/async_image_generation_stream.py`
- `models/google/gemini/image_generation_stream.py`
- `models/google/gemini/pdf_input_file_upload.py`
- `models/google/gemini/pdf_input_local.py`
- `models/google/gemini/pdf_input_url.py`
- `models/litellm/memory.py`
- `models/litellm/pdf_input_local.py`
- `models/litellm/pdf_input_url.py`
- `models/openai/chat/audio_input_and_output_multi_turn.py`
- `models/openai/chat/audio_output_agent.py`
- `models/openai/chat/audio_output_stream.py`
- `models/openai/chat/basic_stream_metrics.py`
- `models/openai/chat/pdf_input_file_upload.py`
- `models/openai/chat/pdf_input_local.py`
- `models/openai/chat/pdf_input_url.py`
- `models/openai/responses/zdr_reasoning_agent.py`
- `models/together/image_agent_with_memory.py`

---

## Test Case 74

**프롬프트**: 도구를 사용할 수 있는 Agno Agent 만들어줘

**파일 경로** (221개):

- `agents/async/concurrent_tool_calls.py`
- `agents/async/data_analyst.py`
- `agents/dependencies/access_dependencies_in_tool.py`
- `agents/human_in_the_loop/agentic_user_input.py`
- `agents/human_in_the_loop/confirmation_required_async.py`
- `agents/human_in_the_loop/confirmation_required_mixed_tools.py`
- `agents/human_in_the_loop/confirmation_required_multiple_tools.py`
- `agents/human_in_the_loop/confirmation_required_with_history.py`
- `agents/human_in_the_loop/user_input_required.py`
- `agents/human_in_the_loop/user_input_required_all_fields.py`
- `agents/human_in_the_loop/user_input_required_async.py`
- `agents/multimodal/01_media_input_for_tool.py`
- `agents/multimodal/agent_same_run_image_analysis.py`
- `agents/multimodal/generate_image_with_intermediate_steps.py`
- `agents/multimodal/generate_video_using_models_lab.py`
- `agents/multimodal/generate_video_using_replicate.py`
- `agents/multimodal/image_to_image_agent.py`
- `agents/multimodal/video_caption_agent.py`
- `agents/state/dynamic_session_state.py`
- `demo/research_agent.py`
- `demo/youtube_agent.py`
- `evals/accuracy/accuracy_9_11_bigger_or_9_99.py`
- `evals/accuracy/accuracy_async.py`
- `evals/accuracy/accuracy_basic.py`
- `evals/accuracy/accuracy_with_tools.py`
- `evals/accuracy/evaluator_agent.py`
- `evals/performance/comparison/autogen_instantiation.py`
- `evals/performance/comparison/crewai_instantiation.py`
- `evals/performance/comparison/langgraph_instantiation.py`
- `evals/performance/comparison/openai_agents_instantiation.py`
- `evals/performance/comparison/smolagents_instantiation.py`
- `evals/reliability/multiple_tool_calls/calculator.py`
- `evals/reliability/reliability_async.py`
- `evals/reliability/single_tool_calls/calculator.py`
- `examples/agents/book_recommendation.py`
- `examples/agents/deep_research_agent_exa.py`
- `examples/agents/fibonacci_agent.py`
- `examples/agents/media_trend_analysis_agent.py`
- `examples/agents/movie_recommedation.py`
- `examples/agents/recipe_creator.py`
- `examples/agents/research_agent_exa.py`
- `examples/agents/shopping_partner.py`
- `examples/agents/social_media_agent.py`
- `examples/agents/startup_analyst_agent.py`
- `examples/agents/study_partner.py`
- `examples/agents/translation_agent.py`
- `examples/agents/web_extraction_agent.py`
- `examples/agents/youtube_agent.py`
- `examples/streamlit_apps/github_mcp_agent/agents.py`
- `examples/streamlit_apps/mcp_agent/app.py`
- `getting_started/04_write_your_own_tool.py`
- `getting_started/07_agent_state.py`
- `getting_started/11_retry_function_call.py`
- `getting_started/12_human_in_the_loop.py`
- `getting_started/15_generate_video.py`
- `getting_started/18_research_agent_exa.py`
- `integrations/memory/zep_integration.py`
- `models/anthropic/code_execution.py`
- `models/anthropic/structured_output_strict_tools.py`
- `models/anthropic/web_fetch.py`
- `models/anthropic/web_search.py`
- `models/groq/browser_search.py`
- `models/groq/research_agent_exa.py`
- `models/groq/transcription_agent.py`
- `models/groq/translation_agent.py`
- `models/langdb/data_analyst.py`
- `models/openai/chat/generate_images.py`
- `models/openai/chat/text_to_speech_agent.py`
- `models/openai/responses/image_generation_agent.py`
- `models/openai/responses/pdf_input_local.py`
- `tools/agentql_tools.py`
- `tools/airflow_tools.py`
- `tools/apify_tools.py`
- `tools/arxiv_tools.py`
- `tools/async/groq-demo.py`
- `tools/async/openai-demo.py`
- `tools/aws_lambda_tools.py`
- `tools/baidusearch_tools.py`
- `tools/bitbucket_tools.py`
- `tools/brandfetch_tools.py`
- `tools/bravesearch_tools.py`
- `tools/brightdata_tools.py`
- `tools/browserbase_tools.py`
- `tools/calcom_tools.py`
- `tools/calculator_tools.py`
- `tools/cartesia_tools.py`
- `tools/clickup_tools.py`
- `tools/confluence_tools.py`
- `tools/csv_tools.py`
- `tools/custom_api_tools.py`
- `tools/custom_async_tools.py`
- `tools/custom_tool_events.py`
- `tools/custom_tools.py`
- `tools/dalle_tools.py`
- `tools/daytona_tools.py`
- `tools/desi_vocal_tools.py`
- `tools/discord_tools.py`
- `tools/docker_tools.py`
- `tools/duckdb_tools.py`
- `tools/elevenlabs_tools.py`
- `tools/email_tools.py`
- `tools/evm_tools.py`
- `tools/exa_tools.py`
- `tools/fal_tools.py`
- `tools/file_tools.py`
- `tools/financial_datasets_tools.py`
- `tools/firecrawl_tools.py`
- `tools/giphy_tools.py`
- `tools/google_bigquery_tools.py`
- `tools/google_drive.py`
- `tools/google_maps_tools.py`
- `tools/googlecalendar_tools.py`
- `tools/googlesheets_tools.py`
- `tools/jira_tools.py`
- `tools/linear_tools.py`
- `tools/linkup_tools.py`
- `tools/lumalabs_tools.py`
- `tools/mcp/agno_mcp.py`
- `tools/mcp/airbnb.py`
- `tools/mcp/brave.py`
- `tools/mcp/cli.py`
- `tools/mcp/filesystem.py`
- `tools/mcp/gibsonai.py`
- `tools/mcp/graphiti.py`
- `tools/mcp/groq_mcp.py`
- `tools/mcp/include_exclude_tools.py`
- `tools/mcp/include_tools.py`
- `tools/mcp/local_server/client.py`
- `tools/mcp/mcp_toolbox_demo/agent.py`
- `tools/mcp/mcp_toolbox_demo/hotel_management_typesafe.py`
- `tools/mcp/mcp_toolbox_for_db.py`
- `tools/mcp/mem0.py`
- `tools/mcp/multiple_servers.py`
- `tools/mcp/multiple_servers_allow_partial_failure.py`
- `tools/mcp/notion_mcp_agent.py`
- `tools/mcp/oxylabs.py`
- `tools/mcp/parallel.py`
- `tools/mcp/pipedream_auth.py`
- `tools/mcp/pipedream_google_calendar.py`
- `tools/mcp/pipedream_linkedin.py`
- `tools/mcp/pipedream_slack.py`
- `tools/mcp/qdrant.py`
- `tools/mcp/sse_transport/client.py`
- `tools/mcp/stagehand.py`
- `tools/mcp/streamable_http_transport/client.py`
- `tools/mcp/stripe.py`
- `tools/mcp/tool_name_prefix.py`
- `tools/mcp_tools.py`
- `tools/mem0_tools.py`
- `tools/memori_tools.py`
- `tools/mlx_transcribe_tools.py`
- `tools/models/azure_openai_tools.py`
- `tools/models/gemini_image_generation.py`
- `tools/models/gemini_video_generation.py`
- `tools/models/morph.py`
- `tools/models/nebius_tools.py`
- `tools/models/openai_tools.py`
- `tools/models_lab_tools.py`
- `tools/moviepy_video_tools.py`
- `tools/nano_banana_tools.py`
- `tools/neo4j_tools.py`
- `tools/newspaper4k_tools.py`
- `tools/newspaper_tools.py`
- `tools/notion_tools.py`
- `tools/openbb_tools.py`
- `tools/opencv_tools.py`
- `tools/openweather_tools.py`
- `tools/other/complex_input_types.py`
- `tools/other/human_in_the_loop.py`
- `tools/other/include_exclude_tools_custom_toolkit.py`
- `tools/other/stop_agent_exception.py`
- `tools/oxylabs_tools.py`
- `tools/pandas_tools.py`
- `tools/postgres_tools.py`
- `tools/pubmed_tools.py`
- `tools/python_function.py`
- `tools/python_function_as_tool.py`
- `tools/python_tools.py`
- `tools/reddit_tools.py`
- `tools/replicate_tools.py`
- `tools/resend_tools.py`
- `tools/scrapegraph_tools.py`
- `tools/searxng_tools.py`
- `tools/serpapi_tools.py`
- `tools/serper_tools.py`
- `tools/shell_tools.py`
- `tools/slack_tools.py`
- `tools/sleep_tools.py`
- `tools/spider_tools.py`
- `tools/sql_tools.py`
- `tools/telegram_tools.py`
- `tools/todoist_tools.py`
- `tools/tool_calls_accesing_agent.py`
- `tools/tool_decorator/async_tool_decorator.py`
- `tools/tool_decorator/cache_tool_calls.py`
- `tools/tool_decorator/tool_decorator.py`
- `tools/tool_decorator/tool_decorator_async.py`
- `tools/tool_decorator/tool_decorator_with_hook.py`
- `tools/tool_decorator/tool_decorator_with_instructions.py`
- `tools/tool_hooks/async_pre_and_post_hooks.py`
- `tools/tool_hooks/pre_and_post_hooks.py`
- `tools/tool_hooks/tool_hook_in_toolkit.py`
- `tools/tool_hooks/tool_hook_in_toolkit_async.py`
- `tools/tool_hooks/tool_hook_in_toolkit_with_state.py`
- `tools/tool_hooks/tool_hook_in_toolkit_with_state_nested.py`
- `tools/tool_hooks/tool_hooks_in_toolkit_nested.py`
- `tools/tool_hooks/tool_hooks_in_toolkit_nested_async.py`
- `tools/trello_tools.py`
- `tools/twilio_tools.py`
- `tools/valyu_tools.py`
- `tools/visualization_tools.py`
- `tools/web_tools.py`
- `tools/webex_tools.py`
- `tools/website_tools.py`
- `tools/whatsapp_tools.py`
- `tools/x_tools.py`
- `tools/youtube_tools.py`
- `tools/zendesk_tools.py`
- `tools/zep_async_tools.py`
- `tools/zep_tools.py`
- `tools/zoom_tools.py`

---

## Test Case 75

**프롬프트**: 벡터 데이터베이스를 사용하는 Knowledge 기반 Agno Agent 만들어줘

**파일 경로** (184개):

- `agents/rag/rag_sentence_transformer.py`
- `agents/rag/rag_with_lance_db_and_sqlite.py`
- `agents/rag/traditional_rag_lancedb.py`
- `agents/rag/traditional_rag_pgvector.py`
- `examples/agents/agent_with_knowledge.py`
- `examples/agents/agno_assist.py`
- `examples/agents/agno_support_agent.py`
- `examples/agents/deep_knowledge.py`
- `examples/agents/legal_consultant.py`
- `examples/agents/recipe_rag_image.py`
- `examples/streamlit_apps/image_generation/agents.py`
- `examples/streamlit_apps/mcp_agent/mcp_agent.py`
- `getting_started/03_agent_with_knowledge.py`
- `getting_started/06_agent_with_storage.py`
- `knowledge/basic_operations/01_from_path.py`
- `knowledge/basic_operations/02_from_url.py`
- `knowledge/basic_operations/03_from_topic.py`
- `knowledge/basic_operations/04_from_multiple.py`
- `knowledge/basic_operations/05_from_youtube.py`
- `knowledge/basic_operations/06_from_s3.py`
- `knowledge/basic_operations/07_from_gcs.py`
- `knowledge/basic_operations/08_include_exclude_files.py`
- `knowledge/basic_operations/09_remove_content.py`
- `knowledge/basic_operations/10_remove_vectors.py`
- `knowledge/basic_operations/11_skip_if_exists.py`
- `knowledge/basic_operations/12_skip_if_exists_contentsdb.py`
- `knowledge/basic_operations/13_specify_reader.py`
- `knowledge/basic_operations/14_sync.py`
- `knowledge/basic_operations/15_text_content.py`
- `knowledge/basic_operations/16_batching.py`
- `knowledge/chunking/csv_row_chunking.py`
- `knowledge/chunking/custom_strategy_example.py`
- `knowledge/chunking/document_chunking.py`
- `knowledge/chunking/fixed_size_chunking.py`
- `knowledge/chunking/recursive_chunking.py`
- `knowledge/chunking/semantic_chunking.py`
- `knowledge/embedders/aws_bedrock_embedder.py`
- `knowledge/embedders/azure_embedder.py`
- `knowledge/embedders/azure_embedder_batching.py`
- `knowledge/embedders/cohere_embedder.py`
- `knowledge/embedders/cohere_embedder_batching.py`
- `knowledge/embedders/fireworks_embedder.py`
- `knowledge/embedders/fireworks_embedder_batching.py`
- `knowledge/embedders/gemini_embedder.py`
- `knowledge/embedders/gemini_embedder_batching.py`
- `knowledge/embedders/huggingface_embedder.py`
- `knowledge/embedders/jina_embedder.py`
- `knowledge/embedders/jina_embedder_batching.py`
- `knowledge/embedders/langdb_embedder.py`
- `knowledge/embedders/mistral_embedder.py`
- `knowledge/embedders/mistral_embedder_batching.py`
- `knowledge/embedders/nebius_embedder.py`
- `knowledge/embedders/ollama_embedder.py`
- `knowledge/embedders/openai_embedder.py`
- `knowledge/embedders/openai_embedder_batching.py`
- `knowledge/embedders/qdrant_fastembed.py`
- `knowledge/embedders/sentence_transformer_embedder.py`
- `knowledge/embedders/together_embedder.py`
- `knowledge/embedders/vllm_embedder_batching_local.py`
- `knowledge/embedders/vllm_embedder_batching_remote.py`
- `knowledge/embedders/vllm_embedder_local.py`
- `knowledge/embedders/vllm_embedder_remote.py`
- `knowledge/embedders/voyageai_embedder.py`
- `knowledge/embedders/voyageai_embedder_batching.py`
- `knowledge/filters/async_filtering.py`
- `knowledge/filters/filtering.py`
- `knowledge/filters/filtering_on_load.py`
- `knowledge/filters/filtering_with_conditions_on_agent.py`
- `knowledge/filters/filtering_with_invalid_keys.py`
- `knowledge/filters/vector_dbs/filtering_chroma_db.py`
- `knowledge/filters/vector_dbs/filtering_lance_db.py`
- `knowledge/filters/vector_dbs/filtering_milvus.py`
- `knowledge/filters/vector_dbs/filtering_mongo_db.py`
- `knowledge/filters/vector_dbs/filtering_pgvector.py`
- `knowledge/filters/vector_dbs/filtering_pinecone.py`
- `knowledge/filters/vector_dbs/filtering_qdrant_db.py`
- `knowledge/filters/vector_dbs/filtering_surrealdb.py`
- `knowledge/filters/vector_dbs/filtering_weaviate.py`
- `knowledge/knowledge_tools.py`
- `knowledge/readers/arxiv_reader.py`
- `knowledge/readers/arxiv_reader_async.py`
- `knowledge/readers/csv_field_labeled_reader.py`
- `knowledge/readers/csv_reader_async.py`
- `knowledge/readers/csv_reader_custom_encodings.py`
- `knowledge/readers/csv_reader_url_async.py`
- `knowledge/readers/doc_kb_async.py`
- `knowledge/readers/markdown_reader_async.py`
- `knowledge/readers/pdf_reader_async.py`
- `knowledge/readers/pdf_reader_password.py`
- `knowledge/readers/pdf_reader_url_password.py`
- `knowledge/readers/pptx_reader.py`
- `knowledge/readers/pptx_reader_async.py`
- `knowledge/readers/tavily_reader_async.py`
- `knowledge/readers/web_search_reader.py`
- `knowledge/readers/web_search_reader_async.py`
- `knowledge/readers/website_reader.py`
- `knowledge/search_type/hybrid_search.py`
- `knowledge/search_type/keyword_search.py`
- `knowledge/search_type/vector_search.py`
- `knowledge/vector_db/cassandra_db/async_cassandra_db.py`
- `knowledge/vector_db/cassandra_db/async_cassandra_db_with_batch_embedder.py`
- `knowledge/vector_db/cassandra_db/cassandra_db.py`
- `knowledge/vector_db/chroma_db/async_chroma_db.py`
- `knowledge/vector_db/chroma_db/async_chroma_db_with_batch_embedder.py`
- `knowledge/vector_db/chroma_db/chroma_db.py`
- `knowledge/vector_db/clickhouse_db/async_clickhouse.py`
- `knowledge/vector_db/clickhouse_db/async_clickhouse_with_batch_embedder.py`
- `knowledge/vector_db/clickhouse_db/clickhouse.py`
- `knowledge/vector_db/couchbase_db/async_couchbase_db.py`
- `knowledge/vector_db/couchbase_db/async_couchbase_db_with_batch_embedder.py`
- `knowledge/vector_db/couchbase_db/couchbase_db.py`
- `knowledge/vector_db/lance_db/async_lance_db_with_batch_embedder.py`
- `knowledge/vector_db/lance_db/lance_db.py`
- `knowledge/vector_db/lance_db/lance_db_hybrid_search.py`
- `knowledge/vector_db/lance_db/lance_db_with_mistral_embedder.py`
- `knowledge/vector_db/langchain/async_langchain_db.py`
- `knowledge/vector_db/langchain/langchain_db.py`
- `knowledge/vector_db/lightrag/lightrag.py`
- `knowledge/vector_db/llamaindex_db/async_llamaindex_db.py`
- `knowledge/vector_db/llamaindex_db/llamaindex_db.py`
- `knowledge/vector_db/milvus_db/async_milvus_db.py`
- `knowledge/vector_db/milvus_db/async_milvus_db_hybrid_search.py`
- `knowledge/vector_db/milvus_db/async_milvus_db_with_batch_embedder.py`
- `knowledge/vector_db/milvus_db/milvus_db.py`
- `knowledge/vector_db/milvus_db/milvus_db_hybrid_search.py`
- `knowledge/vector_db/mongo_db/async_mongo_db.py`
- `knowledge/vector_db/mongo_db/async_mongo_db_with_batch_embedder.py`
- `knowledge/vector_db/mongo_db/cosmos_mongodb_vcore.py`
- `knowledge/vector_db/mongo_db/mongo_db.py`
- `knowledge/vector_db/mongo_db/mongo_db_hybrid_search.py`
- `knowledge/vector_db/pgvector/async_pg_vector.py`
- `knowledge/vector_db/pgvector/async_pg_vector_with_batch_embedder.py`
- `knowledge/vector_db/pgvector/pgvector_db.py`
- `knowledge/vector_db/pgvector/pgvector_hybrid_search.py`
- `knowledge/vector_db/pinecone_db/async_pinecone_db_with_batch_embedder.py`
- `knowledge/vector_db/pinecone_db/pinecone_db.py`
- `knowledge/vector_db/qdrant_db/async_qdrant_db.py`
- `knowledge/vector_db/qdrant_db/async_qdrant_db_with_batch_embedder.py`
- `knowledge/vector_db/qdrant_db/qdrant_db.py`
- `knowledge/vector_db/qdrant_db/qdrant_db_hybrid_search.py`
- `knowledge/vector_db/redis_db/async_redis_db.py`
- `knowledge/vector_db/redis_db/redis_db.py`
- `knowledge/vector_db/singlestore_db/async_singlestore_db_with_batch_embedder.py`
- `knowledge/vector_db/singlestore_db/singlestore_db.py`
- `knowledge/vector_db/surrealdb/async_surreal_db.py`
- `knowledge/vector_db/surrealdb/surreal_db.py`
- `knowledge/vector_db/upstash_db/async_upstash_db_with_batch_embedder.py`
- `knowledge/vector_db/upstash_db/upstash_db.py`
- `knowledge/vector_db/weaviate_db/async_weaviate_db.py`
- `knowledge/vector_db/weaviate_db/async_weaviate_db_with_batch_embedder.py`
- `knowledge/vector_db/weaviate_db/weaviate_db.py`
- `knowledge/vector_db/weaviate_db/weaviate_db_hybrid_search.py`
- `knowledge/vector_db/weaviate_db/weaviate_db_upsert.py`
- `models/anthropic/knowledge.py`
- `models/aws/claude/knowledge.py`
- `models/azure/ai_foundry/knowledge.py`
- `models/azure/openai/knowledge.py`
- `models/cerebras/knowledge.py`
- `models/cerebras_openai/knowledge.py`
- `models/cohere/knowledge.py`
- `models/dashscope/knowledge_tools.py`
- `models/google/gemini/knowledge.py`
- `models/google/gemini/storage_and_memory.py`
- `models/groq/deep_knowledge.py`
- `models/groq/knowledge.py`
- `models/groq/reasoning/demo_qwen_2_5_32B.py`
- `models/ibm/watsonx/knowledge.py`
- `models/litellm/knowledge.py`
- `models/lmstudio/knowledge.py`
- `models/meta/llama/async_knowledge.py`
- `models/meta/llama/knowledge.py`
- `models/meta/llama_openai/knowledge.py`
- `models/nebius/knowledge.py`
- `models/ollama/knowledge.py`
- `models/ollama_tools/knowledge.py`
- `models/openai/chat/knowledge.py`
- `models/openai/responses/knowledge.py`
- `models/perplexity/knowledge.py`
- `models/vercel/knowledge.py`
- `models/vertexai/claude/knowledge.py`
- `reasoning/tools/capture_reasoning_content_knowledge_tools.py`
- `reasoning/tools/knowledge_tools.py`
- `tools/knowledge_tool.py`
- `tools/website_tools_knowledge.py`

---

## Test Case 76

**프롬프트**: 병렬 실행이 가능한 Agno Workflow 만들어줘

**파일 경로** (21개):

- `examples/workflows/company_analysis/run_workflow.py`
- `examples/workflows/company_description/run_workflow.py`
- `examples/workflows/investment_analyst/run_workflow.py`
- `workflows/_01_basic_workflows/_01_sequence_of_steps/sync/workflow_using_steps_nested.py`
- `workflows/_02_workflows_conditional_execution/async/condition_and_parallel_steps.py`
- `workflows/_02_workflows_conditional_execution/async/condition_and_parallel_steps_stream.py`
- `workflows/_02_workflows_conditional_execution/async/condition_with_list_of_steps.py`
- `workflows/_02_workflows_conditional_execution/sync/condition_and_parallel_steps.py`
- `workflows/_02_workflows_conditional_execution/sync/condition_and_parallel_steps_stream.py`
- `workflows/_02_workflows_conditional_execution/sync/condition_with_list_of_steps.py`
- `workflows/_03_workflows_loop_execution/async/loop_with_parallel_steps_stream.py`
- `workflows/_03_workflows_loop_execution/sync/loop_with_parallel_steps.py`
- `workflows/_03_workflows_loop_execution/sync/loop_with_parallel_steps_stream.py`
- `workflows/_04_workflows_parallel_execution/async/parallel_and_condition_steps_stream.py`
- `workflows/_04_workflows_parallel_execution/async/parallel_steps_workflow.py`
- `workflows/_04_workflows_parallel_execution/async/parallel_steps_workflow_stream.py`
- `workflows/_04_workflows_parallel_execution/sync/parallel_and_condition_steps_stream.py`
- `workflows/_04_workflows_parallel_execution/sync/parallel_steps_workflow.py`
- `workflows/_04_workflows_parallel_execution/sync/parallel_steps_workflow_stream.py`
- `workflows/_06_advanced_concepts/_02_early_stopping/early_stop_workflow_with_parallel.py`
- `workflows/_06_advanced_concepts/_09_other/store_events_and_events_to_skip_in_a_workflow.py`

---

## Test Case 77

**프롬프트**: 복잡한 작업을 처리하는 Agno Workflow 만들어줘

**파일 경로** (1개):

- `workflows/_06_advanced_concepts/_05_background_execution/background_execution_using_websocket/websocket_client.py`

---

## Test Case 78

**프롬프트**: 비동기로 동작하는 Agno Agent 만들어줘

**파일 경로** (45개):

- `agents/async/basic.py`
- `agents/caching/async_cache_model_response.py`
- `agents/dependencies/add_dependencies_on_run.py`
- `agents/other/scenario_testing.py`
- `evals/performance/async_function.py`
- `integrations/a2a/basic_agent/basic_agent.py`
- `models/aimlapi/async_basic.py`
- `models/anthropic/async_basic.py`
- `models/aws/bedrock/async_basic.py`
- `models/aws/claude/async_basic.py`
- `models/azure/ai_foundry/async_basic.py`
- `models/azure/openai/async_basic.py`
- `models/cerebras/async_basic.py`
- `models/cerebras_openai/async_basic.py`
- `models/cohere/async_basic.py`
- `models/cometapi/async_basic.py`
- `models/dashscope/async_basic.py`
- `models/deepinfra/async_basic.py`
- `models/deepseek/async_basic.py`
- `models/fireworks/async_basic.py`
- `models/google/gemini/async_basic.py`
- `models/groq/async_basic.py`
- `models/huggingface/async_basic.py`
- `models/ibm/watsonx/async_basic.py`
- `models/litellm/async_basic.py`
- `models/meta/llama/async_basic.py`
- `models/meta/llama_openai/async_basic.py`
- `models/mistral/async_basic.py`
- `models/nebius/async_basic.py`
- `models/nexus/async_basic.py`
- `models/nvidia/async_basic.py`
- `models/ollama/async_basic.py`
- `models/ollama_tools/async_basic.py`
- `models/openai/chat/async_basic.py`
- `models/openai/responses/async_basic.py`
- `models/openrouter/async_basic.py`
- `models/perplexity/async_basic.py`
- `models/portkey/async_basic.py`
- `models/requesty/async_basic.py`
- `models/sambanova/async_basic.py`
- `models/together/async_basic.py`
- `models/vercel/async_basic.py`
- `models/vertexai/claude/async_basic.py`
- `models/vllm/async_basic.py`
- `models/xai/async_basic.py`

---

## Test Case 79

**프롬프트**: 비동기로 동작하는 Agno Team 만들어줘

**파일 경로** (37개):

- `db/mongo/async_mongo/async_mongodb_for_team.py`
- `db/postgres/async_postgres/async_postgres_for_team.py`
- `db/sqlite/async_sqlite/async_sqlite_for_team.py`
- `evals/performance/team_response_with_memory_and_reasoning.py`
- `evals/performance/team_response_with_memory_multi_user.py`
- `evals/performance/team_response_with_memory_simple.py`
- `examples/teams/collaboration_team.py`
- `examples/teams/skyplanner_mcp_team.py`
- `examples/teams/travel_planner_mcp_team.py`
- `integrations/observability/teams/langfuse_via_openinference_async_team.py`
- `reasoning/teams/finance_team_chain_of_thought.py`
- `teams/async_flows/01_async_coordination_team.py`
- `teams/async_flows/02_async_delegate_to_all_members.py`
- `teams/async_flows/03_async_respond_directly.py`
- `teams/async_flows/04_concurrent_member_agents.py`
- `teams/basic_flows/02_respond_directly_router_team.py`
- `teams/basic_flows/03_delegate_to_all_members_cooperation.py`
- `teams/dependencies/add_dependencies_to_context.py`
- `teams/distributed_rag/01_distributed_rag_pgvector.py`
- `teams/distributed_rag/02_distributed_rag_lancedb.py`
- `teams/distributed_rag/03_distributed_rag_with_reranking.py`
- `teams/guardrails/openai_moderation.py`
- `teams/guardrails/pii_detection.py`
- `teams/hooks/output_stream_hook_send_notification.py`
- `teams/hooks/output_validation_post_hook.py`
- `teams/other/run_as_cli.py`
- `teams/reasoning/01_reasoning_multi_purpose_team.py`
- `teams/reasoning/02_async_multi_purpose_reasoning_team.py`
- `teams/search_coordination/02_coordinated_reasoning_rag.py`
- `teams/search_coordination/03_distributed_infinity_search.py`
- `teams/session/10_async_session_summary.py`
- `teams/session/11_search_session_history.py`
- `teams/streaming/02_events.py`
- `teams/streaming/03_async_team_streaming.py`
- `teams/streaming/04_async_team_events.py`
- `teams/structured_input_output/05_async_structured_output_streaming.py`
- `teams/tools/03_async_team_with_tools.py`

---

## Test Case 80

**프롬프트**: 비동기로 실행되는 Agno Workflow 만들어줘

**파일 경로** (33개):

- `db/mongo/async_mongo/async_mongodb_for_workflow.py`
- `db/postgres/async_postgres/async_postgres_for_workflow.py`
- `db/sqlite/async_sqlite/async_sqlite_for_workflow.py`
- `demo/competitive_brief.py`
- `examples/workflows/blog_post_generator.py`
- `examples/workflows/employee_recruiter_async_stream.py`
- `examples/workflows/investment_report_generator.py`
- `examples/workflows/startup_idea_validator.py`
- `getting_started/19_blog_generator_workflow.py`
- `tools/mcp/mcp_toolbox_demo/hotel_management_workflows.py`
- `workflows/_01_basic_workflows/_01_sequence_of_steps/async/run_with_arun_stream.py`
- `workflows/_01_basic_workflows/_01_sequence_of_steps/async/sequence_of_functions_and_agents.py`
- `workflows/_01_basic_workflows/_01_sequence_of_steps/async/sequence_of_functions_and_agents_stream.py`
- `workflows/_01_basic_workflows/_01_sequence_of_steps/async/sequence_of_steps.py`
- `workflows/_01_basic_workflows/_01_sequence_of_steps/async/sequence_of_steps_stream.py`
- `workflows/_01_basic_workflows/_01_sequence_of_steps/async/workflow_using_steps.py`
- `workflows/_01_basic_workflows/_02_step_with_function/async/step_with_async_class.py`
- `workflows/_01_basic_workflows/_02_step_with_function/async/step_with_function_additional_data.py`
- `workflows/_01_basic_workflows/_02_step_with_function/async/step_with_function_stream.py`
- `workflows/_01_basic_workflows/_03_function_instead_of_steps/async/function_instead_of_steps.py`
- `workflows/_01_basic_workflows/_03_function_instead_of_steps/async/function_instead_of_steps_stream.py`
- `workflows/_03_workflows_loop_execution/async/loop_steps_workflow.py`
- `workflows/_03_workflows_loop_execution/async/loop_steps_workflow_stream.py`
- `workflows/_05_workflows_conditional_branching/async/router_steps_workflow.py`
- `workflows/_05_workflows_conditional_branching/async/router_steps_workflow_stream.py`
- `workflows/_05_workflows_conditional_branching/async/router_with_loop_steps.py`
- `workflows/_05_workflows_conditional_branching/async/selector_for_image_video_generation_pipeline.py`
- `workflows/_06_advanced_concepts/_05_background_execution/background_execution_poll.py`
- `workflows/_06_advanced_concepts/_05_background_execution/background_execution_using_websocket/websocket_server.py`
- `workflows/_06_advanced_concepts/_06_guardrails/prompt_injection_workflow.py`
- `workflows/_06_advanced_concepts/_08_workflow_agent/async/basic_workflow_agent.py`
- `workflows/_06_advanced_concepts/_08_workflow_agent/async/basic_workflow_agent_stream.py`
- `workflows/_06_advanced_concepts/_09_other/workflow_tools.py`

---

## Test Case 81

**프롬프트**: 스트리밍 응답을 제공하는 Agno Agent 만들어줘

**파일 경로** (185개):

- `agents/async/reasoning.py`
- `agents/async/streaming.py`
- `agents/caching/async_cache_model_response_stream.py`
- `agents/caching/cache_model_response_stream.py`
- `agents/context_management/instructions_via_function.py`
- `agents/dependencies/add_dependencies_to_context.py`
- `agents/dependencies/reference_dependencies.py`
- `agents/events/reasoning_agent_events.py`
- `agents/hooks/input_transformation_pre_hook.py`
- `agents/input_and_output/input_as_dict.py`
- `agents/input_and_output/input_as_list.py`
- `agents/input_and_output/input_as_message.py`
- `agents/input_and_output/input_as_messages_list.py`
- `agents/multimodal/audio_streaming.py`
- `agents/multimodal/audio_to_text.py`
- `agents/other/cancel_a_run.py`
- `agents/state/session_state_in_instructions.py`
- `getting_started/01_basic_agent.py`
- `getting_started/08_agent_context.py`
- `models/aimlapi/async_basic_stream.py`
- `models/aimlapi/basic_stream.py`
- `models/aimlapi/image_agent.py`
- `models/aimlapi/image_agent_bytes.py`
- `models/anthropic/async_basic_stream.py`
- `models/anthropic/basic_stream.py`
- `models/anthropic/mcp_connector.py`
- `models/anthropic/thinking_stream.py`
- `models/aws/bedrock/async_basic_stream.py`
- `models/aws/bedrock/basic_stream.py`
- `models/aws/claude/async_basic_stream.py`
- `models/aws/claude/basic_stream.py`
- `models/azure/ai_foundry/async_basic_stream.py`
- `models/azure/ai_foundry/basic_stream.py`
- `models/azure/ai_foundry/image_agent.py`
- `models/azure/ai_foundry/image_agent_bytes.py`
- `models/azure/openai/async_basic_stream.py`
- `models/azure/openai/basic_stream.py`
- `models/cerebras/async_basic_stream.py`
- `models/cerebras/basic_stream.py`
- `models/cerebras_openai/async_basic_stream.py`
- `models/cerebras_openai/basic_stream.py`
- `models/cohere/async_basic_stream.py`
- `models/cohere/basic_stream.py`
- `models/cohere/image_agent.py`
- `models/cohere/image_agent_bytes.py`
- `models/cohere/image_agent_local_file.py`
- `models/cometapi/async_basic_stream.py`
- `models/cometapi/basic_stream.py`
- `models/cometapi/image_agent.py`
- `models/dashscope/async_basic_stream.py`
- `models/dashscope/basic_stream.py`
- `models/dashscope/thinking_agent.py`
- `models/deepinfra/async_basic_stream.py`
- `models/deepinfra/basic_stream.py`
- `models/deepseek/async_basic_streaming.py`
- `models/deepseek/basic_stream.py`
- `models/deepseek/reasoning_agent.py`
- `models/fireworks/async_basic_stream.py`
- `models/fireworks/basic_stream.py`
- `models/google/gemini/agent_with_thinking_budget.py`
- `models/google/gemini/async_basic_stream.py`
- `models/google/gemini/audio_input_file_upload.py`
- `models/google/gemini/audio_input_local_file_upload.py`
- `models/google/gemini/basic_stream.py`
- `models/google/gemini/file_upload_with_cache.py`
- `models/google/gemini/grounding.py`
- `models/google/gemini/thinking_agent_stream.py`
- `models/google/gemini/video_input_file_upload.py`
- `models/groq/async_basic_stream.py`
- `models/groq/basic_stream.py`
- `models/groq/image_agent.py`
- `models/groq/reasoning/basic_stream.py`
- `models/groq/reasoning_agent.py`
- `models/huggingface/async_basic_stream.py`
- `models/huggingface/basic_stream.py`
- `models/ibm/watsonx/async_basic_stream.py`
- `models/ibm/watsonx/basic_stream.py`
- `models/ibm/watsonx/image_agent_bytes.py`
- `models/langdb/basic_stream.py`
- `models/litellm/async_basic_stream.py`
- `models/litellm/audio_input_agent.py`
- `models/litellm/basic_stream.py`
- `models/litellm_openai/audio_input_agent.py`
- `models/litellm_openai/basic_stream.py`
- `models/llama_cpp/basic_stream.py`
- `models/lmstudio/basic_stream.py`
- `models/lmstudio/image_agent.py`
- `models/meta/llama/async_basic_stream.py`
- `models/meta/llama/basic_stream.py`
- `models/meta/llama/image_input_file.py`
- `models/meta/llama_openai/async_basic_stream.py`
- `models/meta/llama_openai/basic_stream.py`
- `models/meta/llama_openai/image_input_file.py`
- `models/mistral/async_basic_stream.py`
- `models/mistral/basic_stream.py`
- `models/mistral/image_compare_agent.py`
- `models/nebius/async_basic_stream.py`
- `models/nebius/basic_stream.py`
- `models/nexus/async_basic_stream.py`
- `models/nexus/basic_stream.py`
- `models/nvidia/async_basic_stream.py`
- `models/nvidia/basic_stream.py`
- `models/ollama/async_basic_stream.py`
- `models/ollama/basic_stream.py`
- `models/ollama/demo_gemma.py`
- `models/ollama/ollama_cloud.py`
- `models/ollama_tools/async_basic_stream.py`
- `models/ollama_tools/basic_stream.py`
- `models/openai/chat/async_basic_stream.py`
- `models/openai/chat/audio_input_agent.py`
- `models/openai/chat/audio_input_local_file_upload.py`
- `models/openai/chat/basic_stream.py`
- `models/openai/responses/async_basic_stream.py`
- `models/openai/responses/basic_stream.py`
- `models/openrouter/async_basic_stream.py`
- `models/openrouter/basic_stream.py`
- `models/perplexity/async_basic_stream.py`
- `models/perplexity/basic_stream.py`
- `models/portkey/async_basic_stream.py`
- `models/portkey/basic_stream.py`
- `models/requesty/async_basic_stream.py`
- `models/requesty/basic_stream.py`
- `models/sambanova/async_basic_stream.py`
- `models/sambanova/basic_stream.py`
- `models/siliconflow/async_basic_streaming.py`
- `models/siliconflow/basic_stream.py`
- `models/together/async_basic_stream.py`
- `models/together/basic_stream.py`
- `models/together/image_agent.py`
- `models/together/image_agent_bytes.py`
- `models/vercel/async_basic_stream.py`
- `models/vercel/basic_stream.py`
- `models/vertexai/claude/async_basic_stream.py`
- `models/vertexai/claude/basic_stream.py`
- `models/vertexai/claude/thinking_stream.py`
- `models/vllm/async_basic_stream.py`
- `models/vllm/basic_stream.py`
- `models/xai/async_basic_stream.py`
- `models/xai/basic_stream.py`
- `models/xai/live_search_agent_stream.py`
- `reasoning/agents/analyse_treaty_of_versailles.py`
- `reasoning/agents/capture_reasoning_content_default_COT.py`
- `reasoning/agents/cerebras_llama_default_COT.py`
- `reasoning/agents/default_chain_of_thought.py`
- `reasoning/agents/fibonacci.py`
- `reasoning/agents/ibm_watsonx_default_COT.py`
- `reasoning/agents/is_9_11_bigger_than_9_9.py`
- `reasoning/agents/life_in_500000_years.py`
- `reasoning/agents/logical_puzzle.py`
- `reasoning/agents/mathematical_proof.py`
- `reasoning/agents/mistral_reasoning_cot.py`
- `reasoning/agents/plan_itenerary.py`
- `reasoning/agents/python_101_curriculum.py`
- `reasoning/agents/scientific_research.py`
- `reasoning/agents/ship_of_theseus.py`
- `reasoning/agents/strawberry.py`
- `reasoning/agents/trolley_problem.py`
- `reasoning/models/anthropic/basic_reasoning.py`
- `reasoning/models/azure_ai_foundry/reasoning_model_deepseek.py`
- `reasoning/models/azure_openai/o1.py`
- `reasoning/models/azure_openai/o4_mini.py`
- `reasoning/models/azure_openai/reasoning_model_gpt_4_1.py`
- `reasoning/models/deepseek/9_11_or_9_9.py`
- `reasoning/models/deepseek/analyse_treaty_of_versailles.py`
- `reasoning/models/deepseek/ethical_dilemma.py`
- `reasoning/models/deepseek/fibonacci.py`
- `reasoning/models/deepseek/life_in_500000_years.py`
- `reasoning/models/deepseek/logical_puzzle.py`
- `reasoning/models/deepseek/mathematical_proof.py`
- `reasoning/models/deepseek/plan_itenerary.py`
- `reasoning/models/deepseek/python_101_curriculum.py`
- `reasoning/models/deepseek/scientific_research.py`
- `reasoning/models/deepseek/ship_of_theseus.py`
- `reasoning/models/deepseek/strawberry.py`
- `reasoning/models/deepseek/trolley_problem.py`
- `reasoning/models/gemini/basic_reasoning.py`
- `reasoning/models/groq/9_11_or_9_9.py`
- `reasoning/models/groq/deepseek_plus_claude.py`
- `reasoning/models/ollama/local_reasoning.py`
- `reasoning/models/ollama/reasoning_model_deepseek.py`
- `reasoning/models/openai/o1_pro.py`
- `reasoning/models/openai/o3_mini.py`
- `reasoning/models/openai/o4_mini.py`
- `reasoning/models/openai/reasoning_model_gpt_4_1.py`
- `tools/other/add_tool_after_initialization.py`

---

## Test Case 82

**프롬프트**: 스트리밍 응답을 제공하는 Agno Team 만들어줘

**파일 경로** (2개):

- `teams/streaming/01_team_streaming.py`
- `teams/structured_input_output/04_structured_output_streaming.py`

---

## Test Case 83

**프롬프트**: 스트리밍 응답을 제공하는 Agno Workflow 만들어줘

**파일 경로** (14개):

- `workflows/_01_basic_workflows/_01_sequence_of_steps/sync/sequence_of_functions_and_agents_stream.py`
- `workflows/_01_basic_workflows/_01_sequence_of_steps/sync/sequence_of_steps_stream.py`
- `workflows/_01_basic_workflows/_02_step_with_function/sync/step_with_function_stream.py`
- `workflows/_01_basic_workflows/_03_function_instead_of_steps/sync/function_instead_of_steps_stream.py`
- `workflows/_03_workflows_loop_execution/sync/loop_steps_workflow_stream.py`
- `workflows/_05_workflows_conditional_branching/sync/router_steps_workflow_stream.py`
- `workflows/_06_advanced_concepts/_01_structured_io_at_each_level/structured_io_at_each_level_agent_stream.py`
- `workflows/_06_advanced_concepts/_01_structured_io_at_each_level/structured_io_at_each_level_team_stream.py`
- `workflows/_06_advanced_concepts/_03_access_previous_step_outputs/access_multiple_previous_step_output_stream_2.py`
- `workflows/_06_advanced_concepts/_03_access_previous_step_outputs/access_multiple_previous_steps_output_stream.py`
- `workflows/_06_advanced_concepts/_03_access_previous_step_outputs/access_multiple_previous_steps_output_stream_1.py`
- `workflows/_06_advanced_concepts/_04_shared_session_state/access_session_state_in_custom_function_step_stream.py`
- `workflows/_06_advanced_concepts/_07_other/stream_executor_events.py`
- `workflows/_06_advanced_concepts/_08_workflow_agent/sync/basic_workflow_agent_stream.py`

---

## Test Case 84

**프롬프트**: 여러 Agno Agent로 구성된 Team 만들어줘

**파일 경로** (101개):

- `agents/custom_logging/custom_logging_advanced.py`
- `db/01_persistent_session_storage.py`
- `db/dynamodb/dynamo_for_team.py`
- `db/in_memory/in_memory_storage_for_team.py`
- `db/json_db/json_for_team.py`
- `db/mongo/mongodb_for_team.py`
- `db/mysql/mysql_for_team.py`
- `db/postgres/postgres_for_team.py`
- `db/redis/redis_for_team.py`
- `db/singlestore/singlestore_for_team.py`
- `db/sqlite/sqlite_for_team.py`
- `db/surrealdb/surrealdb_for_team.py`
- `demo/finance_team.py`
- `evals/accuracy/accuracy_team.py`
- `evals/performance/instantiate_team.py`
- `evals/reliability/team/ai_news.py`
- `examples/agents/agent_team.py`
- `examples/streamlit_apps/chess_team/agents.py`
- `examples/teams/ai_customer_support_team.py`
- `examples/teams/autonomous_startup_team.py`
- `examples/teams/content_team.py`
- `examples/teams/hackernews_team.py`
- `examples/teams/multi_language_team.py`
- `examples/teams/multi_purpose_team.py`
- `examples/teams/news_agency_team.py`
- `examples/teams/reasoning_team.py`
- `examples/teams/simple.py`
- `examples/teams/tic_tac_toe_team.py`
- `getting_started/17_agent_team.py`
- `getting_started/readme_examples.py`
- `integrations/observability/maxim_ops.py`
- `integrations/observability/teams/langfuse_via_openinference_team.py`
- `knowledge/filters/filtering_with_conditions_on_team.py`
- `models/groq/agent_team.py`
- `reasoning/teams/knowledge_tool_team.py`
- `reasoning/teams/reasoning_finance_team.py`
- `teams/basic_flows/01_basic_coordination.py`
- `teams/basic_flows/04_respond_directly_with_history.py`
- `teams/basic_flows/05_team_history.py`
- `teams/basic_flows/06_history_of_members.py`
- `teams/basic_flows/07_share_member_interactions.py`
- `teams/basic_flows/caching/cache_team_response.py`
- `teams/context_management/filter_tool_calls_from_history.py`
- `teams/dependencies/access_dependencies_in_tool.py`
- `teams/dependencies/add_dependencies_on_run.py`
- `teams/dependencies/add_dependencies_to_member_context.py`
- `teams/dependencies/reference_dependencies.py`
- `teams/guardrails/prompt_injection.py`
- `teams/hooks/input_transformation_pre_hook.py`
- `teams/hooks/input_validation_pre_hook.py`
- `teams/hooks/output_transformation_post_hook.py`
- `teams/knowledge/01_team_with_knowledge.py`
- `teams/knowledge/02_team_with_knowledge_filters.py`
- `teams/knowledge/03_team_with_agentic_knowledge_filters.py`
- `teams/memory/01_team_with_memory_manager.py`
- `teams/memory/02_team_with_agentic_memory.py`
- `teams/metrics/01_team_metrics.py`
- `teams/multimodal/audio_sentiment_analysis.py`
- `teams/multimodal/audio_to_text.py`
- `teams/multimodal/generate_image_with_team.py`
- `teams/multimodal/image_to_image_transformation.py`
- `teams/multimodal/image_to_structured_output.py`
- `teams/multimodal/image_to_text.py`
- `teams/multimodal/media_input_for_tool.py`
- `teams/multimodal/video_caption_generation.py`
- `teams/other/few_shot_learning.py`
- `teams/other/input_as_dict.py`
- `teams/other/input_as_list.py`
- `teams/other/input_as_messages_list.py`
- `teams/other/response_as_variable.py`
- `teams/other/team_cancel_a_run.py`
- `teams/other/team_exponential_backoff.py`
- `teams/other/team_model_inheritance.py`
- `teams/other/team_model_string.py`
- `teams/search_coordination/01_coordinated_agentic_rag.py`
- `teams/session/01_persistent_session.py`
- `teams/session/02_persistent_session_history.py`
- `teams/session/03_session_summary.py`
- `teams/session/04_session_summary_references.py`
- `teams/session/05_chat_history.py`
- `teams/session/06_rename_session.py`
- `teams/session/07_in_memory_db.py`
- `teams/session/08_cache_session.py`
- `teams/session/09_history_num_messages.py`
- `teams/session/09_share_session_with_agent.py`
- `teams/state/agentic_session_state.py`
- `teams/state/change_state_on_run.py`
- `teams/state/overwrite_stored_session_state.py`
- `teams/state/pass_state_to_members.py`
- `teams/state/session_state_in_instructions.py`
- `teams/state/share_member_interactions.py`
- `teams/state/team_with_nested_shared_state.py`
- `teams/structured_input_output/00_pydantic_model_output.py`
- `teams/structured_input_output/01_pydantic_model_as_input.py`
- `teams/structured_input_output/02_team_with_parser_model.py`
- `teams/structured_input_output/03_team_with_output_model.py`
- `teams/structured_input_output/06_input_schema_on_team.py`
- `teams/team_with_local_agentic_rag.py`
- `teams/tools/01_team_with_custom_tools.py`
- `teams/tools/02_team_with_tool_hooks.py`
- `teams/tools/04_tool_hooks_for_members.py`

---

## Test Case 85

**프롬프트**: 여러 단계로 구성된 Agno Workflow 만들어줘

**파일 경로** (52개):

- `db/in_memory/in_memory_storage_for_workflow.py`
- `db/json_db/json_for_workflows.py`
- `db/postgres/postgres_for_workflow.py`
- `db/redis/redis_for_workflow.py`
- `db/sqlite/sqlite_for_workflow.py`
- `db/surrealdb/surrealdb_for_workflow.py`
- `examples/streamlit_apps/deep_researcher/agents.py`
- `examples/workflows/customer_support/run_workflow.py`
- `examples/workflows/employee_recruiter.py`
- `reasoning/tools/workflow_tools.py`
- `workflows/_01_basic_workflows/_01_sequence_of_steps/sync/sequence_of_functions_and_agents.py`
- `workflows/_01_basic_workflows/_01_sequence_of_steps/sync/sequence_of_steps.py`
- `workflows/_01_basic_workflows/_01_sequence_of_steps/sync/workflow_using_steps.py`
- `workflows/_01_basic_workflows/_01_sequence_of_steps/sync/workflow_with_file_input.py`
- `workflows/_01_basic_workflows/_01_sequence_of_steps/sync/workflow_with_session_metrics.py`
- `workflows/_01_basic_workflows/_02_step_with_function/sync/step_with_class.py`
- `workflows/_01_basic_workflows/_02_step_with_function/sync/step_with_function.py`
- `workflows/_01_basic_workflows/_02_step_with_function/sync/step_with_function_additional_data.py`
- `workflows/_01_basic_workflows/_03_function_instead_of_steps/sync/function_instead_of_steps.py`
- `workflows/_03_workflows_loop_execution/sync/loop_steps_workflow.py`
- `workflows/_05_workflows_conditional_branching/sync/router_steps_workflow.py`
- `workflows/_05_workflows_conditional_branching/sync/router_with_loop_steps.py`
- `workflows/_05_workflows_conditional_branching/sync/selector_for_image_video_generation_pipelines.py`
- `workflows/_06_advanced_concepts/_01_structured_io_at_each_level/pydantic_model_as_input.py`
- `workflows/_06_advanced_concepts/_01_structured_io_at_each_level/structured_io_at_each_level_agent.py`
- `workflows/_06_advanced_concepts/_01_structured_io_at_each_level/structured_io_at_each_level_function.py`
- `workflows/_06_advanced_concepts/_01_structured_io_at_each_level/structured_io_at_each_level_function_1.py`
- `workflows/_06_advanced_concepts/_01_structured_io_at_each_level/structured_io_at_each_level_function_2.py`
- `workflows/_06_advanced_concepts/_01_structured_io_at_each_level/structured_io_at_each_level_team.py`
- `workflows/_06_advanced_concepts/_01_structured_io_at_each_level/workflow_with_input_schema.py`
- `workflows/_06_advanced_concepts/_02_early_stopping/early_stop_workflow_with_agents.py`
- `workflows/_06_advanced_concepts/_02_early_stopping/early_stop_workflow_with_loop.py`
- `workflows/_06_advanced_concepts/_02_early_stopping/early_stop_workflow_with_router.py`
- `workflows/_06_advanced_concepts/_02_early_stopping/early_stop_workflow_with_step.py`
- `workflows/_06_advanced_concepts/_02_early_stopping/early_stop_workflow_with_steps.py`
- `workflows/_06_advanced_concepts/_04_shared_session_state/access_session_state_in_custom_python_function_step.py`
- `workflows/_06_advanced_concepts/_04_shared_session_state/router_with_session_state_in_selector_function.py`
- `workflows/_06_advanced_concepts/_04_shared_session_state/session_state_with_router_workflow.py`
- `workflows/_06_advanced_concepts/_04_shared_session_state/shared_session_state_with_agent.py`
- `workflows/_06_advanced_concepts/_04_shared_session_state/shared_session_state_with_team.py`
- `workflows/_06_advanced_concepts/_07_other/workflow_with_file_input.py`
- `workflows/_06_advanced_concepts/_07_workflow_history/01_single_step_continuous_execution_workflow.py`
- `workflows/_06_advanced_concepts/_07_workflow_history/02_workflow_with_history_enabled_for_steps.py`
- `workflows/_06_advanced_concepts/_07_workflow_history/03_enable_history_for_step.py`
- `workflows/_06_advanced_concepts/_07_workflow_history/04_get_history_in_function.py`
- `workflows/_06_advanced_concepts/_07_workflow_history/05_multi_purpose_cli.py`
- `workflows/_06_advanced_concepts/_07_workflow_history/06_intent_routing_with_history.py`
- `workflows/_06_advanced_concepts/_08_workflow_agent/sync/basic_workflow_agent.py`
- `workflows/_06_advanced_concepts/_09_other/rename_workflow_session.py`
- `workflows/_06_advanced_concepts/_09_other/workflow_cancel_a_run.py`
- `workflows/_06_advanced_concepts/_09_other/workflow_metrics_on_run_response.py`
- `workflows/_06_advanced_concepts/_09_other/workflow_with_image_input.py`

---

## Test Case 86

**프롬프트**: 외부 도구를 사용하는 Agno Agent 만들어줘

**파일 경로** (3개):

- `tools/mcp/local_server/server.py`
- `tools/mcp/sse_transport/server.py`
- `tools/mcp/streamable_http_transport/server.py`

---

## Test Case 87

**프롬프트**: 이미지를 처리할 수 있는 멀티모달 Agno Agent 만들어줘

**파일 경로** (11개):

- `agents/multimodal/image_input_high_fidelity.py`
- `agents/multimodal/image_to_audio.py`
- `agents/multimodal/image_to_text.py`
- `models/anthropic/image_input_file_upload.py`
- `models/anthropic/image_input_local_file.py`
- `models/google/gemini/async_image_editing.py`
- `models/google/gemini/image_editing.py`
- `models/google/gemini/image_generation.py`
- `models/mistral/image_bytes_input_agent.py`
- `models/mistral/image_transcribe_document_agent.py`
- `models/ollama/image_agent.py`

---

## Test Case 88

**프롬프트**: 조건부 실행이 가능한 Agno Workflow 만들어줘

**파일 경로** (5개):

- `workflows/_02_workflows_conditional_execution/async/condition_steps_workflow_stream.py`
- `workflows/_02_workflows_conditional_execution/sync/condition_steps_workflow_stream.py`
- `workflows/_06_advanced_concepts/_02_early_stopping/early_stop_workflow_with_condition.py`
- `workflows/_06_advanced_concepts/_04_shared_session_state/condition_with_session_state_in_evaluator_function.py`
- `workflows/_06_advanced_concepts/_08_workflow_agent/async/workflow_agent_and_conditional_step.py`

---

## Test Case 89

**프롬프트**: 추론 기능이 있는 Agno Agent 만들어줘

**파일 경로** (24개):

- `demo/finance_agent.py`
- `examples/agents/agent_with_reasoning.py`
- `examples/agents/airbnb_mcp.py`
- `examples/agents/competitor_analysis_agent.py`
- `examples/agents/meeting_summarizer_agent.py`
- `examples/agents/reasoning_finance_agent.py`
- `examples/agents/thinking_finance_agent.py`
- `examples/workflows/company_analysis/agents.py`
- `examples/workflows/investment_analyst/agents.py`
- `models/xai/reasoning_agent.py`
- `reasoning/tools/azure_openai_reasoning_tools.py`
- `reasoning/tools/capture_reasoning_content_reasoning_tools.py`
- `reasoning/tools/cerebras_llama_reasoning_tools.py`
- `reasoning/tools/claude_reasoning_tools.py`
- `reasoning/tools/gemini_finance_agent.py`
- `reasoning/tools/gemini_reasoning_tools.py`
- `reasoning/tools/groq_llama_finance_agent.py`
- `reasoning/tools/ibm_watsonx_reasoning_tools.py`
- `reasoning/tools/llama_reasoning_tools.py`
- `reasoning/tools/ollama_reasoning_tools.py`
- `reasoning/tools/openai_reasoning_tools.py`
- `reasoning/tools/reasoning_tools.py`
- `reasoning/tools/vercel_reasoning_tools.py`
- `tools/mcp/supabase.py`

---

