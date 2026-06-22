import Parser from 'rss-parser';

type ParsedFeedItem = {
  externalRef: string;
  title: string;
  content: string;
  source: string | null;
};

type ParsedFeed = {
  title: string;
  items: ParsedFeedItem[];
};

const parser = new Parser();

function stripHtml(value: string) {
  return value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function buildItemContent(item: Record<string, unknown>) {
  const content = [
    item.contentSnippet,
    item.content,
    item.summary,
    item['content:encoded'],
    item.title,
  ]
    .map((value) => (typeof value === 'string' ? stripHtml(value) : ''))
    .find(Boolean);

  return content || '自動収集された項目です。リンク先の本文をご確認ください。';
}

export async function collectFeedItems(url: string, limit: number): Promise<ParsedFeed> {
  const feed = await parser.parseURL(url);
  const items = (feed.items ?? [])
    .slice(0, limit)
    .map((item) => {
      const rawItem = item as unknown as Record<string, unknown>;
      const source = typeof item.link === 'string' ? item.link : null;
      const externalRef =
        (typeof item.guid === 'string' && item.guid) ||
        (typeof item.id === 'string' && item.id) ||
        source ||
        `${feed.title ?? 'feed'}:${item.title ?? 'untitled'}`;

      return {
        externalRef,
        title: String(item.title ?? '自動収集ノウハウ'),
        content: buildItemContent(rawItem),
        source,
      } satisfies ParsedFeedItem;
    })
    .filter((item) => item.title.trim().length > 0);

  return {
    title: feed.title ?? 'RSS / Atom Source',
    items,
  };
}
