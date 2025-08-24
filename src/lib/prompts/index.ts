import {
  newsResponsePrompt,
  newsRetrieverPrompt,
} from './news';
import {
  fundamentalsResponsePrompt,
  fundamentalsRetrieverPrompt,
} from './fundamentals';
import {
  socialResponsePrompt,
  socialRetrieverPrompt,
} from './social';
import { webSearchResponsePrompt, webSearchRetrieverPrompt } from './webSearch';
import { writingAssistantPrompt } from './writingAssistant';
import {
  macroEconomyResponsePrompt,
  macroEconomyRetrieverPrompt,
} from './macroEconomy';

export default {
  webSearchResponsePrompt,
  webSearchRetrieverPrompt,
  newsResponsePrompt,
  newsRetrieverPrompt,
  fundamentalsResponsePrompt,
  fundamentalsRetrieverPrompt,
  socialResponsePrompt,
  socialRetrieverPrompt,
  writingAssistantPrompt,
  macroEconomyResponsePrompt,
  macroEconomyRetrieverPrompt,
  // Keep these for backward compatibility but they will use finance-optimized prompts
  academicSearchResponsePrompt: webSearchResponsePrompt,
  academicSearchRetrieverPrompt: webSearchRetrieverPrompt,
  redditSearchResponsePrompt: socialResponsePrompt,
  redditSearchRetrieverPrompt: socialRetrieverPrompt,
  wolframAlphaSearchResponsePrompt: webSearchResponsePrompt,
  wolframAlphaSearchRetrieverPrompt: webSearchRetrieverPrompt,
  youtubeSearchResponsePrompt: webSearchResponsePrompt,
  youtubeSearchRetrieverPrompt: webSearchRetrieverPrompt,
};
