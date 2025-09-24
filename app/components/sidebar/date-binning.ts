import { format, isAfter, isThisWeek, isThisYear, isToday, isYesterday, subDays } from 'date-fns';
import { zhCN } from 'date-fns/locale/zh-CN';
import type { ServerChatItem } from '~/lib/hooks/useChatEntries';

type Bin = { category: string; items: ServerChatItem[] };

export function binDates(_list: ServerChatItem[]) {
  const list = _list.toSorted((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));

  const binLookup: Record<string, Bin> = {};
  const bins: Array<Bin> = [];

  list.forEach((item) => {
    const category = dateCategory(new Date(item.timestamp));

    if (!(category in binLookup)) {
      const bin = {
        category,
        items: [item],
      };

      binLookup[category] = bin;

      bins.push(bin);
    } else {
      binLookup[category].items.push(item);
    }
  });

  return bins;
}

function dateCategory(date: Date) {
  if (isToday(date)) {
    return '今天';
  }

  if (isYesterday(date)) {
    return '昨天';
  }

  if (isThisWeek(date)) {
    // e.g., "Mon" instead of "Monday"
    return format(date, 'EEE', { locale: zhCN });
  }

  const thirtyDaysAgo = subDays(new Date(), 30);

  if (isAfter(date, thirtyDaysAgo)) {
    return '过去 30 天';
  }

  if (isThisYear(date)) {
    // e.g., "Jan" instead of "January"
    return format(date, 'LLL', { locale: zhCN });
  }

  // e.g., "Jan 2023" instead of "January 2023"
  return format(date, 'LLL yyyy', { locale: zhCN });
}
