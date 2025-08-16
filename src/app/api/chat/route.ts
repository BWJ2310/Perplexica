import prompts from '@/lib/prompts';
import MetaSearchAgent from '@/lib/search/metaSearchAgent';
import crypto from 'crypto';
import { AIMessage, BaseMessage, HumanMessage } from '@langchain/core/messages';
import { EventEmitter } from 'stream';
import {
  chatModelProviders,
  getAvailableChatModelProviders,
  getAvailableEmbeddingModelProviders,
} from '@/lib/providers';
import db from '@/lib/db';
import { chats, messages as messagesSchema } from '@/lib/db/schema';
import { and, eq, gt } from 'drizzle-orm';
import { getFileDetails } from '@/lib/utils/files';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import type { Embeddings } from '@langchain/core/embeddings';
import { searchHandlers } from '@/lib/search';
import { createCustomModel, validateCustomModel } from '@/lib/providers/customModels';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Helper function to extract ticker from message
function extractTicker(message: string): string | null {
  // Common stock ticker patterns
  const patterns = [
    /\b([A-Z]{1,5})\b(?:\s+(?:stock|ticker|price|technical|analysis|indicators?))?/i,
    /\$([A-Z]{1,5})\b/,
    /ticker[:\s]+([A-Z]{1,5})\b/i,
  ];
  
  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match && match[1]) {
      // Validate it looks like a ticker (1-5 uppercase letters)
      const ticker = match[1].toUpperCase();
      if (/^[A-Z]{1,5}$/.test(ticker)) {
        return ticker;
      }
    }
  }
  
  return null;
}

type Message = {
  messageId: string;
  chatId: string;
  content: string;
};

type ChatModel = {
  provider: string;
  model: string;
  apiKey?: string;
  baseUrl?: string;
};

type AlpacaConfig = {
  apiKey: string;
  apiSecret: string;
  ticker?: string;
  timeframe?: '1D' | '1W' | '1M' | '3M' | '6M' | '1Y';
  paper?: boolean;
};

type Body = {
  message: Message;
  optimizationMode: 'speed' | 'balanced' | 'quality';
  focusMode: string;
  history: Array<[string, string]>;
  files: Array<string>;
  chatModel: ChatModel;
  systemInstructions: string;
  alpacaConfig?: AlpacaConfig; // Optional Alpaca configuration for market data
};

const handleEmitterEvents = async (
  stream: EventEmitter,
  writer: WritableStreamDefaultWriter,
  encoder: TextEncoder,
  aiMessageId: string,
  chatId: string,
) => {
  let recievedMessage = '';
  let sources: any[] = [];

  stream.on('data', (data) => {
    const parsedData = JSON.parse(data);
    if (parsedData.type === 'response') {
      writer.write(
        encoder.encode(
          JSON.stringify({
            type: 'message',
            data: parsedData.data,
            messageId: aiMessageId,
          }) + '\n',
        ),
      );

      recievedMessage += parsedData.data;
    } else if (parsedData.type === 'sources') {
      writer.write(
        encoder.encode(
          JSON.stringify({
            type: 'sources',
            data: parsedData.data,
            messageId: aiMessageId,
          }) + '\n',
        ),
      );

      sources = parsedData.data;
    }
  });
  stream.on('end', () => {
    writer.write(
      encoder.encode(
        JSON.stringify({
          type: 'messageEnd',
          messageId: aiMessageId,
        }) + '\n',
      ),
    );
    writer.close();

    db.insert(messagesSchema)
      .values({
        content: recievedMessage,
        chatId: chatId,
        messageId: aiMessageId,
        role: 'assistant',
        metadata: JSON.stringify({
          createdAt: new Date(),
          ...(sources && sources.length > 0 && { sources }),
        }),
      })
      .execute();
  });
  stream.on('error', (data) => {
    const parsedData = JSON.parse(data);
    writer.write(
      encoder.encode(
        JSON.stringify({
          type: 'error',
          data: parsedData.data,
        }),
      ),
    );
    writer.close();
  });
};

const handleHistorySave = async (
  message: Message,
  humanMessageId: string,
  focusMode: string,
  files: string[],
) => {
  const chat = await db.query.chats.findFirst({
    where: eq(chats.id, message.chatId),
  });

  if (!chat) {
    await db
      .insert(chats)
      .values({
        id: message.chatId,
        title: message.content,
        createdAt: new Date().toString(),
        focusMode: focusMode,
        files: files.map(getFileDetails),
      })
      .execute();
  }

  const messageExists = await db.query.messages.findFirst({
    where: eq(messagesSchema.messageId, humanMessageId),
  });

  if (!messageExists) {
    await db
      .insert(messagesSchema)
      .values({
        content: message.content,
        chatId: message.chatId,
        messageId: humanMessageId,
        role: 'user',
        metadata: JSON.stringify({
          createdAt: new Date(),
        }),
      })
      .execute();
  } else {
    await db
      .delete(messagesSchema)
      .where(
        and(
          gt(messagesSchema.id, messageExists.id),
          eq(messagesSchema.chatId, message.chatId),
        ),
      )
      .execute();
  }
};

export const POST = async (req: Request) => {
  try {
    const body = (await req.json()) as Body;
    const { message } = body;

    if (message.content === '') {
      return Response.json(
        {
          message: 'Please provide a message to process',
        },
        { status: 400 },
      );
    }

    const chatModelProviders = await getAvailableChatModelProviders();

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
        return Response.json({ error: validation.error }, { status: 400 });
      }

      llm = createCustomModel(customConfig);
    } else {
      // Use default configured models
      const chatModelProvider =
        chatModelProviders[
          body.chatModel?.provider || Object.keys(chatModelProviders)[0]
        ];
      const chatModel =
        chatModelProvider?.[
          body.chatModel?.model || Object.keys(chatModelProvider || {})[0]
        ];
      
      if (chatModelProvider && chatModel) {
        llm = chatModel.model;
      }
    }

    if (!llm) {
      return Response.json({ error: 'Invalid chat model configuration' }, { status: 400 });
    }

    const humanMessageId =
      message.messageId ?? crypto.randomBytes(7).toString('hex');
    const aiMessageId = crypto.randomBytes(7).toString('hex');

    const history: BaseMessage[] = body.history.map((msg) => {
      if (msg[0] === 'human') {
        return new HumanMessage({
          content: msg[1],
        });
      } else {
        return new AIMessage({
          content: msg[1],
        });
      }
    });

    const handler = searchHandlers[body.focusMode];

    if (!handler) {
      return Response.json(
        {
          message: 'Invalid focus mode',
        },
        { status: 400 },
      );
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

    // If market data mode with Alpaca config, enrich system instructions with data
    let enrichedSystemInstructions = body.systemInstructions || '';
    
    if (body.focusMode === 'marketData' && body.alpacaConfig?.apiKey && body.alpacaConfig?.apiSecret) {
      try {
        const { AlpacaMarketData, TechnicalAnalysis } = await import('@/lib/financial/alpacaClient');
        const alpaca = new AlpacaMarketData(body.alpacaConfig);
        
        // Extract ticker from message or use provided ticker
        const ticker = body.alpacaConfig.ticker || extractTicker(message.content);
        const timeframe = body.alpacaConfig.timeframe || '1M';
        
        if (ticker) {
          // Fetch historical data and calculate indicators
          const historicalData = await alpaca.getHistoricalData(ticker, timeframe);
          const indicators = TechnicalAnalysis.calculateIndicators(historicalData);
          const quote = await alpaca.getLatestQuote(ticker);
          
          // Add the calculated data to system instructions
          enrichedSystemInstructions = `
${body.systemInstructions || ''}

## ALPACA MARKET DATA AVAILABLE:
Ticker: ${ticker}
Timeframe: ${timeframe}
Data Points: ${historicalData.length}

### Current Market Data:
- Price: $${indicators.current_price?.toFixed(2)}
- Change: ${indicators.price_change_percent?.toFixed(2)}%
- Bid/Ask: $${quote?.bid?.toFixed(2)}/$${quote?.ask?.toFixed(2)}

### Technical Indicators (Calculated):
- RSI(14): ${indicators.rsi_14?.toFixed(2)}
- MACD: ${indicators.macd?.macd_line?.toFixed(3)}
- SMA(20): $${indicators.sma_20?.toFixed(2)}
- SMA(50): $${indicators.sma_50?.toFixed(2)}
- Bollinger Bands: Upper: $${indicators.bollinger_bands?.upper?.toFixed(2)}, Lower: $${indicators.bollinger_bands?.lower?.toFixed(2)}
- ATR(14): ${indicators.atr_14?.toFixed(2)}
- Volume Ratio: ${indicators.volume_ratio?.toFixed(2)}x average
- Stochastic: K: ${indicators.stochastic?.k?.toFixed(2)}, D: ${indicators.stochastic?.d?.toFixed(2)}

### Support/Resistance:
- Support Levels: ${indicators.support_levels?.map(l => `$${l.toFixed(2)}`).join(', ')}
- Resistance Levels: ${indicators.resistance_levels?.map(l => `$${l.toFixed(2)}`).join(', ')}
- Pivot Points: R1: $${indicators.pivot_point?.r1?.toFixed(2)}, S1: $${indicators.pivot_point?.s1?.toFixed(2)}

Note: This is real calculated data from Alpaca Markets API, not web search results.
Present this data in your response along with any additional web search findings.`;
        }
      } catch (error) {
        console.error('Failed to fetch Alpaca data:', error);
        // Continue without Alpaca data if it fails
      }
    }
    
    const stream = await handler.searchAndAnswer(
      message.content,
      history,
      llm,
      embeddings,
      body.optimizationMode,
      body.files,
      enrichedSystemInstructions,
    );

    const responseStream = new TransformStream();
    const writer = responseStream.writable.getWriter();
    const encoder = new TextEncoder();

    handleEmitterEvents(stream, writer, encoder, aiMessageId, message.chatId);
    handleHistorySave(message, humanMessageId, body.focusMode, body.files);

    return new Response(responseStream.readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        Connection: 'keep-alive',
        'Cache-Control': 'no-cache, no-transform',
      },
    });
  } catch (err) {
    console.error('An error occurred while processing chat request:', err);
    return Response.json(
      { message: 'An error occurred while processing chat request' },
      { status: 500 },
    );
  }
};
