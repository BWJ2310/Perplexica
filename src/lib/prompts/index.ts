import {
  financeNewsResponsePrompt,
  financeNewsRetrieverPrompt,
} from './financeNews';
import {
  financeFundamentalsResponsePrompt,
  financeFundamentalsRetrieverPrompt,
} from './financeFundamentals';
import {
  financeSocialResponsePrompt,
  financeSocialRetrieverPrompt,
} from './financeSocial';
import { webSearchResponsePrompt, webSearchRetrieverPrompt } from './webSearch';
import { writingAssistantPrompt } from './writingAssistant';

export default {
  webSearchResponsePrompt,
  webSearchRetrieverPrompt,
  financeNewsResponsePrompt,
  financeNewsRetrieverPrompt,
  financeFundamentalsResponsePrompt,
  financeFundamentalsRetrieverPrompt,
  financeSocialResponsePrompt,
  financeSocialRetrieverPrompt,
  writingAssistantPrompt,
  // Keep these for backward compatibility but they will use finance-optimized prompts
  academicSearchResponsePrompt: webSearchResponsePrompt,
  academicSearchRetrieverPrompt: webSearchRetrieverPrompt,
  redditSearchResponsePrompt: financeSocialResponsePrompt,
  redditSearchRetrieverPrompt: financeSocialRetrieverPrompt,
  wolframAlphaSearchResponsePrompt: webSearchResponsePrompt,
  wolframAlphaSearchRetrieverPrompt: webSearchRetrieverPrompt,
  youtubeSearchResponsePrompt: webSearchResponsePrompt,
  youtubeSearchRetrieverPrompt: webSearchRetrieverPrompt,
};
