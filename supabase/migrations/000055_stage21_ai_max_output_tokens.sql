-- Stage 21: align AI route output-token defaults with DeepSeek V4 provider limits.

update app.ai_route_valves
set
  default_value = '384000'::jsonb,
  description = 'Maximum provider output tokens for DeepSeek V4 routes.',
  updated_at = timezone('utc', now())
where key = 'max_output_tokens'
  and route_code in (
    'default_chat',
    'agent_general',
    'rag_legal_summary',
    'document_generation_assist',
    'canvas_ai_assist'
  );
