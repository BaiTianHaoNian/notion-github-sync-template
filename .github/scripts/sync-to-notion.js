const { Client } = require('@notionhq/client');
const fs = require('fs');
const path = require('path');

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const projectPageId = process.env.NOTION_PROJECT_PAGE_ID;

// ========== 配置区域 ==========
const SYNC_DIRS = ['.'];

const EXCLUDE_PATTERNS = [
  'node_modules', '.git', '.github', '.kiro',
  'package.json', 'package-lock.json', '.gitignore', '.DS_Store',
];

const BIDIRECTIONAL_EXTENSIONS = ['.md'];

// Notion 支持的所有代码语言
const CODE_EXTENSIONS = {
  '.abap': 'abap', '.arduino': 'arduino', '.bash': 'bash', '.basic': 'basic',
  '.c': 'c', '.clj': 'clojure', '.clojure': 'clojure', '.coffee': 'coffeescript',
  '.cpp': 'c++', '.cc': 'c++', '.cxx': 'c++', '.cs': 'c#', '.css': 'css',
  '.dart': 'dart', '.diff': 'diff', '.docker': 'docker', '.dockerfile': 'docker',
  '.elixir': 'elixir', '.ex': 'elixir', '.elm': 'elm', '.erb': 'ruby',
  '.erl': 'erlang', '.flow': 'flow', '.f': 'fortran', '.f90': 'fortran',
  '.fs': 'f#', '.gherkin': 'gherkin', '.feature': 'gherkin',
  '.glsl': 'glsl', '.go': 'go', '.graphql': 'graphql', '.gql': 'graphql',
  '.groovy': 'groovy', '.haskell': 'haskell', '.hs': 'haskell',
  '.html': 'html', '.htm': 'html', '.java': 'java', '.js': 'javascript',
  '.mjs': 'javascript', '.cjs': 'javascript', '.json': 'json',
  '.jsonc': 'json', '.julia': 'julia', '.jl': 'julia',
  '.kt': 'kotlin', '.kts': 'kotlin', '.latex': 'latex', '.tex': 'latex',
  '.less': 'less', '.lisp': 'lisp', '.cl': 'lisp', '.livescript': 'livescript',
  '.ls': 'livescript', '.lua': 'lua', '.makefile': 'makefile', '.mk': 'makefile',
  '.md': 'markdown', '.markup': 'markup', '.matlab': 'm', '.m': 'matlab',
  '.mermaid': 'mermaid', '.nix': 'nix', '.objc': 'objective-c',
  '.ocaml': 'ocaml', '.ml': 'ocaml', '.pascal': 'pascal', '.pas': 'pascal',
  '.perl': 'perl', '.pl': 'perl', '.php': 'php', '.txt': 'plain text',
  '.text': 'plain text', '.ps1': 'powershell', '.psm1': 'powershell',
  '.proto': 'protobuf', '.py': 'python', '.pyw': 'python',
  '.r': 'r', '.R': 'r', '.reason': 'reason', '.re': 'reason',
  '.rb': 'ruby', '.rs': 'rust', '.sass': 'sass', '.scala': 'scala',
  '.sc': 'scala', '.scheme': 'scheme', '.scm': 'scheme', '.scss': 'scss',
  '.sh': 'shell', '.zsh': 'shell', '.fish': 'shell',
  '.sql': 'sql', '.swift': 'swift', '.ts': 'typescript', '.mts': 'typescript',
  '.cts': 'typescript', '.tsx': 'typescript', '.jsx': 'javascript',
  '.vb': 'vb.net', '.vbs': 'vb.net', '.verilog': 'verilog', '.v': 'verilog',
  '.vhdl': 'vhdl', '.vhd': 'vhdl', '.vue': 'vue',
  '.wasm': 'webassembly', '.xml': 'xml', '.xsl': 'xml', '.xslt': 'xml',
  '.yaml': 'yaml', '.yml': 'yaml', '.zig': 'zig',
  // 配置文件
  '.env': 'shell', '.gitattributes': 'shell', '.editorconfig': 'shell',
  '.prettierrc': 'json', '.eslintrc': 'json', '.babelrc': 'json',
  '.npmrc': 'shell', '.nvmrc': 'shell',
  // 其他
  '.toml': 'toml', '.ini': 'ini', '.cfg': 'ini', '.conf': 'shell',
  '.log': 'plain text', '.csv': 'plain text',
};

const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.ico', '.bmp'];

// ========== 语言规范化映射 ==========
// Markdown 代码块中的语言别名 -> Notion 接受的语言名称
const LANGUAGE_ALIAS_MAP = {
  // Shell 相关
  'sh': 'shell',
  'bash': 'shell',
  'zsh': 'shell',
  'fish': 'shell',
  'powershell': 'powershell',
  'ps1': 'powershell',
  'cmd': 'shell',
  'bat': 'shell',
  'terminal': 'shell',
  'console': 'shell',
  
  // JavaScript/TypeScript
  'js': 'javascript',
  'jsx': 'javascript',
  'ts': 'typescript',
  'tsx': 'typescript',
  'mjs': 'javascript',
  'cjs': 'javascript',
  'node': 'javascript',
  
  // Python
  'py': 'python',
  'py3': 'python',
  'python3': 'python',
  
  // Web
  'htm': 'html',
  'scss': 'scss',
  'less': 'less',
  'styl': 'css',
  'stylus': 'css',
  
  // Data formats
  'yml': 'yaml',
  'jsonc': 'json',
  'json5': 'json',
  
  // C/C++
  'c++': 'c++',
  'cpp': 'c++',
  'cc': 'c++',
  'cxx': 'c++',
  'h': 'c',
  'hpp': 'c++',
  
  // Other languages
  'rb': 'ruby',
  'rs': 'rust',
  'kt': 'kotlin',
  'kts': 'kotlin',
  'cs': 'c#',
  'csharp': 'c#',
  'fs': 'f#',
  'fsharp': 'f#',
  'vb': 'visual basic',
  'md': 'markdown',
  'mkd': 'markdown',
  'tex': 'latex',
  'dockerfile': 'docker',
  'makefile': 'makefile',
  'mk': 'makefile',
  'proto': 'protobuf',
  'graphql': 'graphql',
  'gql': 'graphql',
  'pl': 'perl',
  'pm': 'perl',
  'ex': 'elixir',
  'exs': 'elixir',
  'erl': 'erlang',
  'hs': 'haskell',
  'ml': 'ocaml',
  'clj': 'clojure',
  'cljs': 'clojure',
  'lisp': 'lisp',
  'scm': 'scheme',
  'rkt': 'scheme',
  'v': 'verilog',
  'vhd': 'vhdl',
  'vhdl': 'vhdl',
  'pas': 'pascal',
  'f90': 'fortran',
  'f95': 'fortran',
  'for': 'fortran',
  'abap': 'abap',
  'coffee': 'coffeescript',
  'dart': 'dart',
  'elm': 'elm',
  'groovy': 'groovy',
  'lua': 'lua',
  'nix': 'nix',
  'r': 'r',
  'scala': 'scala',
  'sc': 'scala',
  'swift': 'swift',
  'toml': 'toml',
  'ini': 'ini',
  'cfg': 'ini',
  'conf': 'shell',
  'xml': 'xml',
  'xsl': 'xml',
  'svg': 'xml',
  'diff': 'diff',
  'patch': 'diff',
  'sql': 'sql',
  'mysql': 'sql',
  'pgsql': 'sql',
  'plsql': 'sql',
  'text': 'plain text',
  'txt': 'plain text',
  'log': 'plain text',
  'plaintext': 'plain text',
  '': 'plain text'
};

// Notion 支持的所有语言
const NOTION_LANGUAGES = new Set([
  'abap', 'arduino', 'bash', 'basic', 'c', 'clojure', 'coffeescript', 'c++', 'c#',
  'css', 'dart', 'diff', 'docker', 'elixir', 'elm', 'erlang', 'flow', 'fortran',
  'f#', 'gherkin', 'glsl', 'go', 'graphql', 'groovy', 'haskell', 'html', 'java',
  'javascript', 'json', 'julia', 'kotlin', 'latex', 'less', 'lisp', 'livescript',
  'lua', 'makefile', 'markdown', 'markup', 'matlab', 'mermaid', 'nix', 'objective-c',
  'ocaml', 'pascal', 'perl', 'php', 'plain text', 'powershell', 'prolog', 'protobuf',
  'python', 'r', 'reason', 'ruby', 'rust', 'sass', 'scala', 'scheme', 'scss',
  'shell', 'sql', 'swift', 'typescript', 'vb.net', 'verilog', 'vhdl', 'visual basic',
  'webassembly', 'xml', 'yaml', 'java/c/c++/c#', 'notion formula', 'toml', 'ini', 'vue'
]);

// 规范化语言名称
function normalizeLanguage(lang) {
  if (!lang || lang.trim() === '') {
    return 'plain text';
  }
  
  const normalized = lang.toLowerCase().trim();
  
  // 先检查别名映射表
  if (LANGUAGE_ALIAS_MAP[normalized]) {
    return LANGUAGE_ALIAS_MAP[normalized];
  }
  
  // 检查是否是 Notion 直接支持的语言
  if (NOTION_LANGUAGES.has(normalized)) {
    return normalized;
  }
  
  // 未知语言，使用 plain text
  console.log(`  Warning: Unknown language "${lang}", using "plain text"`);
  return 'plain text';
}
// =============================

// 缓存已创建的文件夹页面
const folderPageCache = {};

function shouldExclude(filePath) {
  return EXCLUDE_PATTERNS.some(pattern => filePath.includes(pattern));
}

function getAllFiles(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    if (shouldExclude(filePath)) continue;
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      getAllFiles(filePath, fileList);
    } else {
      fileList.push(filePath);
    }
  }
  return fileList;
}

function markdownToNotionBlocks(content) {
  const blocks = [];
  const lines = content.split('\n');
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith('### ')) {
      blocks.push({ object: 'block', type: 'heading_3', heading_3: { rich_text: [{ type: 'text', text: { content: line.slice(4) } }] } });
    } else if (line.startsWith('## ')) {
      blocks.push({ object: 'block', type: 'heading_2', heading_2: { rich_text: [{ type: 'text', text: { content: line.slice(3) } }] } });
    } else if (line.startsWith('# ')) {
      blocks.push({ object: 'block', type: 'heading_1', heading_1: { rich_text: [{ type: 'text', text: { content: line.slice(2) } }] } });
    } else if (line.startsWith('```')) {
      // 使用语言规范化函数
      const rawLang = line.slice(3).trim();
      const lang = normalizeLanguage(rawLang);
      const codeLines = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      blocks.push({ object: 'block', type: 'code', code: { rich_text: [{ type: 'text', text: { content: codeLines.join('\n') } }], language: lang } });
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      blocks.push({ object: 'block', type: 'bulleted_list_item', bulleted_list_item: { rich_text: [{ type: 'text', text: { content: line.slice(2) } }] } });
    } else if (/^\d+\.\s/.test(line)) {
      blocks.push({ object: 'block', type: 'numbered_list_item', numbered_list_item: { rich_text: [{ type: 'text', text: { content: line.replace(/^\d+\.\s/, '') } }] } });
    } else if (line.trim() !== '') {
      blocks.push({ object: 'block', type: 'paragraph', paragraph: { rich_text: [{ type: 'text', text: { content: line } }] } });
    }
    i++;
  }
  return blocks;
}

function codeFileToNotionBlocks(content, language) {
  const blocks = [];
  const maxChunkSize = 1900;
  // 确保语言名称是 Notion 接受的
  const normalizedLang = normalizeLanguage(language);
  for (let i = 0; i < content.length; i += maxChunkSize) {
    blocks.push({
      object: 'block', type: 'code',
      code: { rich_text: [{ type: 'text', text: { content: content.slice(i, i + maxChunkSize) } }], language: normalizedLang }
    });
  }
  return blocks;
}

function imageFileToNotionBlocks(filePath, repoUrl) {
  return [{ object: 'block', type: 'image', image: { type: 'external', external: { url: `${repoUrl}/raw/main/${filePath}` } } }];
}

function otherFileToNotionBlocks(filePath, repoUrl) {
  return [{ object: 'block', type: 'bookmark', bookmark: { url: `${repoUrl}/blob/main/${filePath}` } }];
}

async function findChildPage(parentId, title) {
  const blocks = await notion.blocks.children.list({ block_id: parentId });
  for (const block of blocks.results) {
    if (block.type === 'child_page' && block.child_page.title === title) {
      return block.id;
    }
  }
  return null;
}

async function getOrCreateFolderPage(parentId, folderName) {
  const cacheKey = `${parentId}:${folderName}`;
  if (folderPageCache[cacheKey]) return folderPageCache[cacheKey];

  let pageId = await findChildPage(parentId, `📁 ${folderName}`);
  if (!pageId) {
    const page = await notion.pages.create({
      parent: { page_id: parentId },
      icon: { emoji: '📁' },
      properties: { title: { title: [{ text: { content: `📁 ${folderName}` } }] } }
    });
    pageId = page.id;
    console.log(`  Created folder: ${folderName}`);
  }
  folderPageCache[cacheKey] = pageId;
  return pageId;
}

async function clearPageContent(pageId) {
  const blocks = await notion.blocks.children.list({ block_id: pageId });
  for (const block of blocks.results) {
    if (block.type !== 'child_page') {
      await notion.blocks.delete({ block_id: block.id });
    }
  }
}

async function syncFile(filePath, repoUrl) {
  const ext = path.extname(filePath).toLowerCase();
  const fileName = path.basename(filePath);
  const dirPath = path.dirname(filePath);
  const folders = dirPath === '.' ? [] : dirPath.split(path.sep);

  // 递归创建文件夹结构
  let parentId = projectPageId;
  for (const folder of folders) {
    parentId = await getOrCreateFolderPage(parentId, folder);
  }

  let blocks = [];
  let syncType = '';
  let icon = '📄';

  if (BIDIRECTIONAL_EXTENSIONS.includes(ext)) {
    const content = fs.readFileSync(filePath, 'utf-8');
    blocks = markdownToNotionBlocks(content);
    syncType = 'markdown';
    icon = '📝';
  } else if (CODE_EXTENSIONS[ext]) {
    const content = fs.readFileSync(filePath, 'utf-8');
    blocks = codeFileToNotionBlocks(content, CODE_EXTENSIONS[ext]);
    syncType = 'code';
    icon = '💻';
  } else if (IMAGE_EXTENSIONS.includes(ext)) {
    blocks = imageFileToNotionBlocks(filePath, repoUrl);
    syncType = 'image';
    icon = '🖼️';
  } else {
    blocks = otherFileToNotionBlocks(filePath, repoUrl);
    syncType = 'other';
    icon = '📎';
  }

  console.log(`Syncing [${syncType}]: ${filePath}`);

  const existingPageId = await findChildPage(parentId, fileName);

  if (existingPageId) {
    await clearPageContent(existingPageId);
    for (let i = 0; i < blocks.length; i += 100) {
      await notion.blocks.children.append({ block_id: existingPageId, children: blocks.slice(i, i + 100) });
    }
    console.log(`  Updated: ${fileName}`);
  } else {
    const page = await notion.pages.create({
      parent: { page_id: parentId },
      icon: { emoji: icon },
      properties: { title: { title: [{ text: { content: fileName } }] } }
    });
    for (let i = 0; i < blocks.length; i += 100) {
      await notion.blocks.children.append({ block_id: page.id, children: blocks.slice(i, i + 100) });
    }
    console.log(`  Created: ${fileName}`);
  }
}

async function main() {
  if (!process.env.NOTION_TOKEN || !process.env.NOTION_PROJECT_PAGE_ID) {
    console.error('Missing NOTION_TOKEN or NOTION_PROJECT_PAGE_ID');
    process.exit(1);
  }

  const repoUrl = process.env.GITHUB_SERVER_URL && process.env.GITHUB_REPOSITORY
    ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}`
    : 'https://github.com/your-repo';

  let allFiles = [];
  for (const dir of SYNC_DIRS) {
    allFiles = allFiles.concat(getAllFiles(dir));
  }
  allFiles = [...new Set(allFiles)];

  console.log(`Found ${allFiles.length} files to sync`);

  for (const filePath of allFiles) {
    try {
      await syncFile(filePath, repoUrl);
    } catch (error) {
      console.error(`Error syncing ${filePath}:`, error.message);
    }
  }
  console.log('Sync completed!');
}

main();
