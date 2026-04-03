/**
 * Extract - 从 snapshot 中提取结构化数据
 */

import type { SnapshotNode } from '../device/interface.js';

export type ExtractMode = 'products' | 'reviews' | 'list' | 'text';

export interface ProductItem {
  name: string;
  price: string;
  shop?: string;
  sold?: string;
}

export interface ReviewItem {
  user: string;
  content: string;
  rating?: string;
}

export interface ExtractResult {
  mode: ExtractMode;
  count: number;
  items: ProductItem[] | ReviewItem[] | string[];
}

/**
 * 从 snapshot nodes 中提取商品信息
 */
export function extractProducts(nodes: SnapshotNode[], limit: number = 20): ProductItem[] {
  const items: ProductItem[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < nodes.length; i++) {
    const text = nodes[i].text || '';
    if (!text) continue;

    // 商品名特征: 包含 "·" 分隔符（品牌·商品名格式）
    const isProduct = text.includes('·') && text.length > 10;
    if (!isProduct) continue;

    const key = text.slice(0, 25);
    if (seen.has(key)) continue;
    seen.add(key);

    let price = '';
    let shop = '';
    let sold = '';

    for (let j = i + 1; j < Math.min(i + 15, nodes.length); j++) {
      const t = nodes[j].text || '';
      if (t.includes('¥') && t.length < 40 && !price) {
        const priceMatch = t.match(/¥(\d+\.?\d*)/);
        if (priceMatch) price = '¥' + priceMatch[1];
        const soldMatch = t.match(/已售([\d.]+万?\+?)/);
        if (soldMatch) sold = soldMatch[1];
      }
      if ((t.includes('旗舰店') || t.includes('专营店') || t.endsWith('的店')) && t.length < 25 && !shop) {
        shop = t;
      }
    }

    if (price) {
      const parts = text.split('·', 2);
      const brand = parts.length > 1 ? parts[0] : '';
      const name = parts.length > 1 ? parts[1] : text;

      items.push({
        name: brand ? `${brand} ${name.slice(0, 40)}` : name.slice(0, 50),
        price,
        shop: shop || brand || undefined,
        sold: sold || undefined,
      });

      if (items.length >= limit) break;
    }
  }

  return items;
}

/**
 * 从 snapshot nodes 中提取评论信息
 */
export function extractReviews(nodes: SnapshotNode[], limit: number = 20): ReviewItem[] {
  const reviews: ReviewItem[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < nodes.length; i++) {
    const text = nodes[i].text || '';
    if (!text) continue;

    // 评论特征：
    // 1. 长度在 10-200 之间
    // 2. 不包含价格、店铺、运费等关键词
    // 3. 可能以引号开头（小红书评论格式）
    const isReview =
      text.length >= 10 &&
      text.length <= 200 &&
      !text.includes('¥') &&
      !text.includes('已售') &&
      !text.includes('退货') &&
      !text.includes('包运费') &&
      !text.includes('加购') &&
      !text.includes('旗舰店') &&
      !text.includes('的店') &&
      !text.includes('立减') &&
      !text.includes('商品评价') &&
      !text.match(/^\d+$/) && // 纯数字
      (text.startsWith('"') || text.startsWith('"') || text.length > 20);

    if (!isReview) continue;

    // 去重
    const key = text.slice(0, 30);
    if (seen.has(key)) continue;
    seen.add(key);

    // 往前找用户名
    let user = '用户';
    for (let j = Math.max(0, i - 3); j < i; j++) {
      const name = nodes[j].text || '';
      // 用户名特征：2-12字符，不含特殊关键词
      if (
        name.length >= 2 &&
        name.length <= 12 &&
        !name.includes('评') &&
        !name.includes('¥') &&
        !name.includes('售')
      ) {
        user = name;
        break;
      }
    }

    // 清理评论内容
    let content = text;
    if (content.startsWith('"') || content.startsWith('"')) {
      content = content.slice(1);
    }
    if (content.endsWith('"') || content.endsWith('"') || content.endsWith('..."')) {
      content = content.replace(/[""\.]+$/, '');
    }

    reviews.push({ user, content });

    if (reviews.length >= limit) break;
  }

  return reviews;
}

/**
 * 提取列表项
 */
export function extractList(nodes: SnapshotNode[], limit: number = 50): string[] {
  const items: string[] = [];
  const seen = new Set<string>();

  for (const node of nodes) {
    const text = node.text || node.contentDesc || '';
    if (!text || text.length < 2 || text.length > 100) continue;
    if (seen.has(text)) continue;
    if (['搜索', '返回', '首页', '我', '发布', '消息'].includes(text)) continue;

    seen.add(text);
    items.push(text);

    if (items.length >= limit) break;
  }

  return items;
}

/**
 * 提取所有文本
 */
export function extractText(nodes: SnapshotNode[]): string[] {
  return nodes.map((n) => n.text || n.contentDesc || '').filter((t) => t.length > 0);
}

/**
 * 统一提取接口
 */
export function extract(
  nodes: SnapshotNode[],
  mode: ExtractMode,
  limit?: number,
): ExtractResult {
  switch (mode) {
    case 'products':
      const products = extractProducts(nodes, limit || 20);
      return { mode, count: products.length, items: products };

    case 'reviews':
      const reviews = extractReviews(nodes, limit || 20);
      return { mode, count: reviews.length, items: reviews };

    case 'list':
      const list = extractList(nodes, limit || 50);
      return { mode, count: list.length, items: list };

    case 'text':
      const texts = extractText(nodes);
      return { mode, count: texts.length, items: texts };

    default:
      throw new Error(`Unknown extract mode: ${mode}`);
  }
}
