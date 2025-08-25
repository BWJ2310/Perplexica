import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import type { Embeddings } from '@langchain/core/embeddings';
import {
  getAvailableChatModelProviders,
  getAvailableEmbeddingModelProviders,
} from '@/lib/providers';
import { AIMessage, BaseMessage, HumanMessage } from '@langchain/core/messages';
import { MetaSearchAgentType } from '@/lib/search/metaSearchAgent';
import { searchHandlers } from '@/lib/search';
import { createCustomModel, validateCustomModel } from '@/lib/providers/customModels';

interface chatModel {
  provider: string;
  model: string;
  apiKey?: string;
  baseUrl?: string;
}

interface ChatRequestBody {
  optimizationMode: 'speed' | 'balanced';
  focusMode: string;
  chatModel?: chatModel;
  query: string;
  history: Array<[string, string]>;
  stream?: boolean;
  systemInstructions?: string;
  maxSources?: number;
  maxToken?: number;
  includeImages?: boolean;
  includeVideos?: boolean;
}

export const POST = async (req: Request) => {
  try {
    // Log request origin (only in development)
    if (process.env.NODE_ENV === 'development') {
      const origin = req.headers.get('origin') || 'unknown';
      const userAgent = req.headers.get('user-agent') || 'unknown';
      const referer = req.headers.get('referer') || 'none';
      const forwardedFor = req.headers.get('x-forwarded-for');
      const realIp = req.headers.get('x-real-ip');
      const ip = forwardedFor || realIp || 'unknown';
      
      console.log('=== Incoming Search Request ===');
      console.log('Origin:', origin);
      console.log('Referer:', referer);
      console.log('IP:', ip);
      console.log('User-Agent:', userAgent);
      console.log('Timestamp:', new Date().toISOString());
      
      const body: ChatRequestBody = await req.json();
      
      console.log('Focus Mode:', body.focusMode);
      console.log('Query:', body.query);
      console.log('Optimization:', body.optimizationMode || 'balanced');
      console.log('Custom AI:', body.chatModel ? `${body.chatModel.provider}/${body.chatModel.model}` : 'default');
      console.log('================================');
      
      // Re-parse body since we already consumed it
      req = new Request(req, { body: JSON.stringify(body) });
    }
    
    const body: ChatRequestBody = await req.json();

    if (!body.focusMode || !body.query) {
      return Response.json(
        { message: 'Missing focus mode or query' },
        { status: 400 },
      );
    }

    body.history = body.history || [];
    body.optimizationMode = body.optimizationMode || 'balanced';
    body.stream = body.stream || false;

    const history: BaseMessage[] = body.history.map((msg) => {
      return msg[0] === 'human'
        ? new HumanMessage({ content: msg[1] })
        : new AIMessage({ content: msg[1] });
    });

    let llm: BaseChatModel | undefined;

    // Check if custom model configuration is provided
    if (body.chatModel?.apiKey && body.chatModel?.model) {
      const customConfig = {
        provider: body.chatModel.provider,
        model: body.chatModel.model,
        apiKey: body.chatModel.apiKey,
        baseUrl: body.chatModel.baseUrl,
      };

      const validation = validateCustomModel(customConfig);
      if (!validation.isValid) {
        return Response.json({ message: validation.error }, { status: 400 });
      }

      llm = createCustomModel(customConfig);
    } else {
      // Use default configured models
      const chatModelProviders = await getAvailableChatModelProviders();
      
      const chatModelProvider =
        body.chatModel?.provider || Object.keys(chatModelProviders)[0];
      const chatModel =
        body.chatModel?.model ||
        Object.keys(chatModelProviders[chatModelProvider] || {})[0];
      
      if (
        chatModelProviders[chatModelProvider] &&
        chatModelProviders[chatModelProvider][chatModel]
      ) {
        llm = chatModelProviders[chatModelProvider][chatModel]
          .model as unknown as BaseChatModel | undefined;
      }
    }

    if (!llm) {
      return Response.json(
        { message: 'Invalid model configuration' },
        { status: 400 },
      );
    }

    const searchHandler = searchHandlers[body.focusMode];

    if (!searchHandler) {
      return Response.json({ message: 'Invalid focus mode' }, { status: 400 });
    }

    // Get system-configured embedding model for reranking
    let embeddings: Embeddings | null = null;
    if (body.optimizationMode === 'balanced') {
      const embeddingProviders = await getAvailableEmbeddingModelProviders();
      
      // Try to get the first available embedding model from system configuration
      for (const provider of Object.keys(embeddingProviders)) {
        const models = embeddingProviders[provider];
        if (models && Object.keys(models).length > 0) {
          const firstModel = Object.keys(models)[0];
          embeddings = models[firstModel].model;
          break;
        }
      }
    }

    const emitter = await searchHandler.searchAndAnswer(
      body.query,
      history,
      llm,
      embeddings,
      body.optimizationMode,
      [],
      body.systemInstructions || '',
      body.maxSources,
      body.maxToken || 4000,
      body.includeImages,
      body.includeVideos,
    );

    if (!body.stream) {
      return new Promise(
        (
          resolve: (value: Response) => void,
          reject: (value: Response) => void,
        ) => {
          let message = '';
          let sources: any[] = [];

          emitter.on('data', (data: string) => {
            try {
              const parsedData = JSON.parse(data);
              if (parsedData.type === 'response') {
                message += parsedData.data;
              } else if (parsedData.type === 'sources') {
                sources = parsedData.data;
              }
            } catch (error) {
              reject(
                Response.json(
                  { message: 'Error parsing data' },
                  { status: 500 },
                ),
              );
            }
          });

          emitter.on('end', () => {
            resolve(Response.json({ message, sources }, { status: 200 }));
          });

          emitter.on('error', (error: any) => {
            reject(
              Response.json(
                { message: 'Search error', error },
                { status: 500 },
              ),
            );
          });
        },
      );
    }

    const encoder = new TextEncoder();

    const abortController = new AbortController();
    const { signal } = abortController;

    const stream = new ReadableStream({
      start(controller) {
        let sources: any[] = [];

        controller.enqueue(
          encoder.encode(
            JSON.stringify({
              type: 'init',
              data: 'Stream connected',
            }) + '\n',
          ),
        );

        signal.addEventListener('abort', () => {
          emitter.removeAllListeners();

          try {
            controller.close();
          } catch (error) {}
        });

        emitter.on('data', (data: string) => {
          if (signal.aborted) return;

          try {
            const parsedData = JSON.parse(data);

            if (parsedData.type === 'response') {
              controller.enqueue(
                encoder.encode(
                  JSON.stringify({
                    type: 'response',
                    data: parsedData.data,
                  }) + '\n',
                ),
              );
            } else if (parsedData.type === 'sources') {
              sources = parsedData.data;
              controller.enqueue(
                encoder.encode(
                  JSON.stringify({
                    type: 'sources',
                    data: sources,
                  }) + '\n',
                ),
              );
            }
          } catch (error) {
            controller.error(error);
          }
        });

        emitter.on('end', () => {
          if (signal.aborted) return;

          controller.enqueue(
            encoder.encode(
              JSON.stringify({
                type: 'done',
              }) + '\n',
            ),
          );
          controller.close();
        });

        emitter.on('error', (error: any) => {
          if (signal.aborted) return;

          controller.error(error);
        });
      },
      cancel() {
        abortController.abort();
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      },
    });
  } catch (err: any) {
    console.error(`Error in getting search results: ${err.message}`);
    return Response.json(
      { message: 'An error has occurred.' },
      { status: 500 },
    );
  }
};
