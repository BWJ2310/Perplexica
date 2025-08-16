import { searchSearxng } from '@/lib/searxng';

const websitesForTopic = {
  markets: {
    query: ['stock market news', 'market analysis', 'trading', 'indices', 'S&P 500', 'NASDAQ'],
    links: ['bloomberg.com', 'marketwatch.com', 'wsj.com', 'reuters.com'],
  },
  finance: {
    query: ['finance news', 'economy', 'banking', 'financial markets', 'investing'],
    links: ['bloomberg.com', 'cnbc.com', 'ft.com', 'marketwatch.com'],
  },
  crypto: {
    query: ['cryptocurrency news', 'bitcoin', 'ethereum', 'blockchain', 'DeFi'],
    links: ['coindesk.com', 'cointelegraph.com', 'decrypt.co', 'theblock.co'],
  },
  economy: {
    query: ['economic news', 'GDP', 'inflation', 'federal reserve', 'interest rates'],
    links: ['reuters.com', 'bloomberg.com', 'wsj.com', 'ft.com'],
  },
  earnings: {
    query: ['earnings reports', 'quarterly results', 'company earnings', 'revenue'],
    links: ['seekingalpha.com', 'marketwatch.com', 'cnbc.com', 'yahoo.com'],
  },
};

type Topic = keyof typeof websitesForTopic;

export const GET = async (req: Request) => {
  try {
    const params = new URL(req.url).searchParams;

    const mode: 'normal' | 'preview' =
      (params.get('mode') as 'normal' | 'preview') || 'normal';
    const topic: Topic = (params.get('topic') as Topic) || 'finance';

    const selectedTopic = websitesForTopic[topic];

    let data = [];

    if (mode === 'normal') {
      const seenUrls = new Set();

      data = (
        await Promise.all(
          selectedTopic.links.flatMap((link) =>
            selectedTopic.query.map(async (query) => {
              return (
                await searchSearxng(`site:${link} ${query}`, {
                  engines: ['bing news'],
                  pageno: 1,
                  language: 'en',
                })
              ).results;
            }),
          ),
        )
      )
        .flat()
        .filter((item) => {
          const url = item.url?.toLowerCase().trim();
          if (seenUrls.has(url)) return false;
          seenUrls.add(url);
          return true;
        })
        .sort(() => Math.random() - 0.5);
    } else {
      data = (
        await searchSearxng(
          `site:${selectedTopic.links[Math.floor(Math.random() * selectedTopic.links.length)]} ${selectedTopic.query[Math.floor(Math.random() * selectedTopic.query.length)]}`,
          {
            engines: ['bing news'],
            pageno: 1,
            language: 'en',
          },
        )
      ).results;
    }

    return Response.json(
      {
        blogs: data,
      },
      {
        status: 200,
      },
    );
  } catch (err) {
    console.error(`An error occurred in discover route:`, err);
    
    // Check if it's a configuration error
    if (err instanceof Error && err.message.includes('SearXNG')) {
      return Response.json(
        {
          message: 'Search service not configured. Please configure SearXNG API endpoint.',
          error: err.message,
        },
        {
          status: 503, // Service Unavailable
        },
      );
    }
    
    return Response.json(
      {
        message: 'An error has occurred',
        error: err instanceof Error ? err.message : 'Unknown error',
      },
      {
        status: 500,
      },
    );
  }
};
