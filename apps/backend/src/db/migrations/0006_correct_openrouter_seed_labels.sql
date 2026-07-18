UPDATE "models"
SET
  "name" = 'DeepSeek Chat',
  "cost_tier" = 'paid',
  "cost_input_per_1m_usd_micros" = 240000,
  "cost_output_per_1m_usd_micros" = 900000,
  "updated_at" = now()
WHERE "id" = 'mdl_deepseek_chat_free'
  AND "external_model_key" = 'deepseek/deepseek-chat-v3-0324';

UPDATE "models"
SET
  "name" = 'Qwen3 30B A3B',
  "cost_tier" = 'paid',
  "cost_input_per_1m_usd_micros" = 120000,
  "cost_output_per_1m_usd_micros" = 500000,
  "updated_at" = now()
WHERE "id" = 'mdl_qwen3_30b_free'
  AND "external_model_key" = 'qwen/qwen3-30b-a3b';
