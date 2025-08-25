import { ChatOpenAI } from '@langchain/openai';
import { ChatAnthropic } from '@langchain/anthropic';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';

export type CustomProvider = 'deepseek' | 'claude' | 'google' | 'openai' | 'openrouter' | 'custom';

interface CustomModelConfig {
  provider: CustomProvider | string;
  model: string;
  apiKey: string;
  baseUrl?: string;
  temperature?: number;
}

// Provider-specific base URLs
const PROVIDER_BASE_URLS: Record<string, string> = {
  deepseek: 'https://api.deepseek.com/v1',
  openrouter: 'https://openrouter.ai/api/v1',
  openai: 'https://api.openai.com/v1',
  claude: 'https://api.anthropic.com',
  google: '', // Google uses a different setup
};

// Provider-specific model mappings (common models)
const PROVIDER_MODELS: Record<string, string[]> = {
  deepseek: ['deepseek-chat', 'deepseek-coder'],
  claude: ['claude-3-opus-20240229', 'claude-3-sonnet-20240229', 'claude-3-haiku-20240307', 'claude-3-5-sonnet-20241022'],
  google: ['gemini-pro', 'gemini-1.5-pro', 'gemini-1.5-flash'],
  openai: ['gpt-4-turbo', 'gpt-4', 'gpt-3.5-turbo', 'gpt-4o', 'gpt-4o-mini'],
  openrouter: ['anthropic/claude-3-opus', 'openai/gpt-4-turbo', 'google/gemini-pro', 'meta-llama/llama-3-70b-instruct'],
};

export function createCustomModel(config: CustomModelConfig): BaseChatModel {
  const { provider, model, apiKey, baseUrl, temperature = 0.7 } = config;
  
  // Normalize provider name to lowercase for comparison
  const normalizedProvider = provider?.toLowerCase();

  // Handle Anthropic/Claude models
  if (normalizedProvider === 'claude' || normalizedProvider === 'anthropic') {
    return new ChatAnthropic({
      apiKey: apiKey,
      modelName: model,
      temperature: temperature,
      anthropicApiUrl: baseUrl || PROVIDER_BASE_URLS.claude,
    }) as unknown as BaseChatModel;
  }

  // Handle Google/Gemini models
  if (normalizedProvider === 'google' || normalizedProvider === 'gemini') {
    return new ChatGoogleGenerativeAI({
      apiKey: apiKey,
      model: model,
      temperature: temperature,
      // Google doesn't use baseURL in the same way
    }) as unknown as BaseChatModel;
  }

  // Handle DeepSeek models (OpenAI-compatible)
  if (normalizedProvider === 'deepseek') {
    return new ChatOpenAI({
      apiKey: apiKey,
      modelName: model,
      temperature: temperature,
      configuration: {
        baseURL: baseUrl || PROVIDER_BASE_URLS.deepseek,
      },
    }) as unknown as BaseChatModel;
  }

  // Handle OpenRouter models (OpenAI-compatible)
  if (normalizedProvider === 'openrouter') {
    return new ChatOpenAI({
      apiKey: apiKey,
      modelName: model,
      temperature: temperature,
      maxTokens: 4000, // Default max tokens to prevent credit issues
      configuration: {
        baseURL: baseUrl || PROVIDER_BASE_URLS.openrouter,
        defaultHeaders: {
          'HTTP-Referer': 'https://perplexica.ai', // Required for OpenRouter
          'X-Title': 'Perplexica',
        },
      },
    }) as unknown as BaseChatModel;
  }

  // Handle OpenAI explicitly
  if (normalizedProvider === 'openai') {
    return new ChatOpenAI({
      apiKey: apiKey,
      modelName: model,
      temperature: temperature,
      configuration: {
        baseURL: baseUrl || PROVIDER_BASE_URLS.openai,
      },
    }) as unknown as BaseChatModel;
  }

  // Handle any other OpenAI-compatible providers (custom endpoints)
  return new ChatOpenAI({
    apiKey: apiKey,
    modelName: model,
    temperature: temperature,
    configuration: {
      baseURL: baseUrl || PROVIDER_BASE_URLS[provider] || 'https://api.openai.com/v1',
    },
  }) as unknown as BaseChatModel;
}

export function getProviderInfo(provider: string): {
  baseUrl: string;
  models: string[];
  requiresApiKey: boolean;
} {
  return {
    baseUrl: PROVIDER_BASE_URLS[provider] || '',
    models: PROVIDER_MODELS[provider] || [],
    requiresApiKey: true,
  };
}

export function validateCustomModel(config: CustomModelConfig): {
  isValid: boolean;
  error?: string;
} {
  if (!config.apiKey) {
    return { isValid: false, error: 'API key is required' };
  }

  if (!config.model) {
    return { isValid: false, error: 'Model name is required' };
  }

  if (!config.provider) {
    return { isValid: false, error: 'Provider is required' };
  }

  // Validate known providers have valid models (optional check)
  const knownModels = PROVIDER_MODELS[config.provider];
  if (knownModels && knownModels.length > 0) {
    // This is just a warning, not a hard error since providers add new models frequently
    if (!knownModels.includes(config.model)) {
      console.warn(`Model ${config.model} may not be available for provider ${config.provider}`);
    }
  }

  return { isValid: true };
}