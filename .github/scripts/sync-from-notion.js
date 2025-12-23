const { Client } = require('@notionhq/client');
const fs = require('fs');
const path = require('path');

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const projectPageId = process.env.NOTION_PROJECT_PAGE_ID;

// ========== 配置区域 ==========
// Notion 页面名称 -> 本地文件路径
const PAGE_FILE_MAP = {
  'Readme': 'README.md',
  // 'Guide': 'docs/guide.md',
  // 添加更多映射...
};
// =============================

async function blocksToMarkdown(blocks) {
  let markdown = '';
  let prevType = '';
  
  for (const block of blocks) {
    const text = extractText(block);
    const currentType = block.type;
    
    if (prevType.includes('list_item') && !currentType.includes('list_item')) {
      markdown += '\n';
    }
    
    switch (block.type) {
      case 'heading_1':
        markdown += `# ${text}\n\n`;
        break;
      case 'heading_2':
        markdown += `## ${text}\n\n`;
        break;
      case 'heading_3':
        markdown += `### ${text}\n\n`;
        break;
      case 'paragraph':
        if (text) markdown += `${text}\n\n`;
        break;
      case 'bulleted_list_item':
        markdown += `- ${text}\n`;
        break;
      case 'numbered_list_item':
        markdown += `1. ${text}\n`;
        break;
      case 'code':
        const lang = block.code?.language || '';
        const code = block.code?.rich_text?.map(t => t.plain_text).join('') || '';
        markdown += `\`\`\`${lang}\n${code}\n\`\`\`\n\n`;
        break;
      case 'divider':
        markdown += `---\n\n`;
        break;
      case 'quote':
      case 'callout':
        markdown += `> ${text}\n\n`;
        break;
      case 'to_do':
        const checked = block.to_do?.checked ? 'x' : ' ';
        markdown += `- [${checked}] ${text}\n`;
        break;
      default:
        if (text) markdown += `${text}\n\n`;
    }
    prevType = currentType;
  }
  return markdown.replace(/\n{3,}/g, '\n\n').trim() + '\n';
}

function extractText(block) {
  const type = block.type;
  const content = block[type];
  if (!content || !content.rich_text) return '';
  
  return content.rich_text.map(t => {
    let text = t.plain_text;
    if (t.annotations) {
      if (t.annotations.bold) text = `**${text}**`;
      if (t.annotations.italic) text = `*${text}*`;
      if (t.annotations.code) text = `\`${text}\``;
      if (t.annotations.strikethrough) text = `~~${text}~~`;
    }
    return text;
  }).join('');
}

async function getPageBlocks(pageId) {
  const blocks = [];
  let cursor;
  do {
    const response = await notion.blocks.children.list({
      block_id: pageId,
      start_cursor: cursor,
      page_size: 100
    });
    blocks.push(...response.results);
    cursor = response.has_more ? response.next_cursor : null;
  } while (cursor);
  return blocks;
}

async function getProjectPages(projectPageId) {
  const blocks = await getPageBlocks(projectPageId);
  const pages = [];
  for (const block of blocks) {
    if (block.type === 'child_page') {
      pages.push({ id: block.id, title: block.child_page.title });
    }
  }
  return pages;
}

async function syncPage(pageId, title) {
  const filePath = PAGE_FILE_MAP[title];
  if (!filePath) {
    console.log(`  Skipping: ${title} (no mapping)`);
    return;
  }
  
  console.log(`Syncing: ${title} -> ${filePath}`);
  
  const blocks = await getPageBlocks(pageId);
  const markdown = await blocksToMarkdown(blocks);
  
  const dir = path.dirname(filePath);
  if (dir !== '.' && !fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  let existingContent = '';
  if (fs.existsSync(filePath)) {
    existingContent = fs.readFileSync(filePath, 'utf-8');
  }
  
  if (existingContent.trim() !== markdown.trim()) {
    fs.writeFileSync(filePath, markdown);
    console.log(`  Updated: ${filePath}`);
  } else {
    console.log(`  No changes: ${filePath}`);
  }
}

async function main() {
  if (!process.env.NOTION_TOKEN || !process.env.NOTION_PROJECT_PAGE_ID) {
    console.error('Missing NOTION_TOKEN or NOTION_PROJECT_PAGE_ID');
    process.exit(1);
  }

  console.log('Fetching pages from Notion...');
  const pages = await getProjectPages(projectPageId);
  console.log(`Found ${pages.length} pages`);
  
  for (const page of pages) {
    try {
      await syncPage(page.id, page.title);
    } catch (error) {
      console.error(`Error syncing ${page.title}:`, error.message);
    }
  }
  console.log('Sync completed!');
}

main();
