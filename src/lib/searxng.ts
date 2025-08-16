import axios from 'axios';
import { getSearxngApiEndpoint } from './config';

interface SearxngSearchOptions {
  categories?: string[];
  engines?: string[];
  language?: string;
  pageno?: number;
}

interface SearxngSearchResult {
  title: string;
  url: string;
  img_src?: string;
  thumbnail_src?: string;
  thumbnail?: string;
  content?: string;
  author?: string;
  iframe_src?: string;
}

// Finance-specific search query optimization
const optimizeQueryForFinance = (query: string, engines?: string[]): string => {
  // If searching on specific platforms, add relevant finance terms
  if (engines?.includes('reddit')) {
    // Add finance subreddit context if not already present
    if (!query.includes('site:reddit.com') && !query.includes('r/')) {
      const financeSubreddits = ['wallstreetbets', 'investing', 'stocks', 'StockMarket', 'SecurityAnalysis', 'options', 'Daytrading'];
      const randomSubs = financeSubreddits.slice(0, 3).join(' OR r/');
      return `${query} (r/${randomSubs})`;
    }
  }
  
  if (engines?.includes('youtube')) {
    // Add finance-related terms for YouTube searches
    const financeTerms = ['stock market', 'investing', 'trading', 'finance', 'analysis'];
    const hasFinanceTerms = financeTerms.some(term => query.toLowerCase().includes(term));
    if (!hasFinanceTerms) {
      return `${query} finance investing`;
    }
  }
  
  // For general searches, prioritize financial sources
  if (!engines || engines.length === 0 || engines.includes('google') || engines.includes('bing')) {
    const financeKeywords = ['stock', 'market', 'finance', 'investing', 'trading', 'earnings', 'analysis'];
    const hasFinanceContext = financeKeywords.some(keyword => query.toLowerCase().includes(keyword));
    if (!hasFinanceContext) {
      return `${query} financial market`;
    }
  }
  
  return query;
};

export const searchSearxng = async (
  query: string,
  opts?: SearxngSearchOptions,
) => {
  const searxngURL = getSearxngApiEndpoint();
  
  // Optimize query for finance content
  const optimizedQuery = optimizeQueryForFinance(query, opts?.engines);

  // Prevent empty queries which cause 400 errors
  if (!optimizedQuery || optimizedQuery.trim() === '') {
    console.warn('Empty query detected, skipping SearXNG search');
    return { results: [], suggestions: [] };
  }

  const url = new URL(`${searxngURL}/search?format=json`);
  url.searchParams.append('q', optimizedQuery);

  if (opts) {
    Object.keys(opts).forEach((key) => {
      const value = opts[key as keyof SearxngSearchOptions];
      if (Array.isArray(value)) {
        url.searchParams.append(key, value.join(','));
        return;
      }
      url.searchParams.append(key, value as string);
    });
  }

  try {
    const res = await axios.get(url.toString(), {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (compatible; Perplexica/1.0)',
      },
      timeout: 5000,
    });

    const results: SearxngSearchResult[] = res.data.results || [];
    const suggestions: string[] = res.data.suggestions || [];

    return { results, suggestions };
  } catch (error: any) {
    if (error.response?.status === 403) {
      // Log once, not every time
      if (!global.searxngWarningShown) {
        console.warn('⚠️ SearXNG is returning 403. Web search disabled. Check if JSON format is enabled in SearXNG settings.');
        global.searxngWarningShown = true;
      }
      // Return empty results to allow app to continue working
      return { results: [], suggestions: [] };
    }
    if (error.code === 'ECONNREFUSED') {
      console.warn('⚠️ Cannot connect to SearXNG at', searxngURL);
      return { results: [], suggestions: [] };
    }
    // For other errors, still return empty results
    console.error('SearXNG error:', error.message);
    return { results: [], suggestions: [] };
  }
};
