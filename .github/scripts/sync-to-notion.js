const { Client } = require('@notionhq/client');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const fetch = require('node-fetch');

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const projectPageId = process.env.NOTION_PROJECT_PAGE_ID;

// ========== 配置区域 ==========
// 使用 '.' 扫描整个仓库，通过 EXCLUDE_PATTERNS 过滤不需要的文件
const SYNC_DIRS = ['.'];

const EXCLUDE_PATTERNS = [
  'node_modules', '.git', '.github', '.kiro',
  'package.json', 'package-lock.json', '.gitignore', '.DS_Store',
  'dist', 'build', '.cache', 'coverage',
];

const BIDIRECTIONAL_EXTENSIONS = ['.md'];

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
  '.env': 'shell', '.gitattributes': 'shell', '.editorconfig': 'shell',
  '.prettierrc': 'json', '.eslintrc': 'json', '.babelrc': 'json',
  '.npmrc': 'shell', '.nvmrc': 'shell',
  '.toml': 'toml', '.ini': 'ini', '.cfg': 'ini', '.conf': 'shell',
  '.log': 'plain text', '.csv': 'plain text',
};

// 图片文件扩展名
const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.ico', '.bmp'];

// 文档文件扩展名（将作为文件附件上传）
const DOCUMENT_EXTENSIONS = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.zip', '.rar', '.7z', '.tar', '.gz'];

// 文件大小限制（20MB）
const MAX_FILE_SIZE = 20 * 1024 * 1024;

// ========== 语言规范化映射 ==========
const LANGUAGE_ALIAS_MAP = {
  'sh': 'shell', 'bash': 'shell', 'zsh': 'shell', 'fish': 'shell',
  'js': 'javascript', 'jsx': 'javascript', 'ts': 'typescript', 'tsx': 'typescript',
  'py': 'python', 'py3': 'python', 'python3': 'python',
  'htm': 'html', 'scss': 'scss', 'less': 'less',
  'yml': 'yaml', 'jsonc': 'json', 'json5': 'json',
  'c++': 'c++', 'cpp': 'c++', 'cc': 'c++', 'cxx': 'c++',
  'rb': 'ruby', 'rs': 'rust', 'kt': 'kotlin', 'cs': 'c#',
  'md': 'markdown', 'tex': 'latex', 'dockerfile': 'docker',
  'sql': 'sql', 'text': 'plain text', 'txt': 'plain text', '': 'plain text'
};

const NOTION_LANGUAGES = new Set([
  'abap', 'arduino', 'bash', 'basic', 'c', 'clojure', 'coffeescript', 'c++', 'c#',
  'css', 'dart', 'diff', 'docker', 'elixir', 'elm', 'erlang', 'flow', 'fortran',
  'f#', 'gherkin', 'glsl', 'go', 'graphql', 'groovy', 'haskell', 'html', 'java',
  'javascript', 'json', 'julia', 'kotlin', 'latex', 'less', 'lisp', 'livescript',
  'lua', 'makefile', 'markdown', 'markup', 'matlab', 'mermaid', 'nix', 'objective-c',
  'ocaml', 'pascal', 'perl', 'php', 'plain text', 'powershell', 'prolog', 'protobuf',
  'python', 'r', 'reason', 'ruby', 'rust', 'sass', 'scala', 'scheme', 'scss',
  'shell', 'sql', 'swift', 'typescript', 'vb.net', 'verilog', 'vhdl', 'visual basic',
  'webassembly', 'xml', 'yaml', 'toml', 'ini', 'vue'
]);

function normalizeLanguage(lang) {
  if (!lang || lang.trim() === '') return 'plain text';
  const normalized = lang.toLowerCase().trim();
  if (LANGUAGE_ALIAS_MAP[normalized]) return LANGUAGE_ALIAS_MAP[normalized];
  if (NOTION_LANGUAGES.has(normalized)) return normalized;
  console.log(`  Warning: Unknown language "${lang}", using "plain text"`);
  return 'plain text';
}

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

// ========== 文件上传功能 ==========
async function uploadFileToNotion(filePath) {
  const fileName = path.basename(filePath);
  const stats = fs.statSync(filePath);
  
  // 检查文件大小
  if (stats.size > MAX_FILE_SIZE) {
    console.log(`  Skipping ${fileName}: File too large (${(stats.size / 1024 / 1024).toFixed(2)}MB > 20MB)`);
    return null;
  }

  try {
    // 步骤1: 创建文件上传对象
    console.log(`  Creating upload for: ${fileName}`);
    const createResponse = await fetch('https://api.notion.com/v1/file_uploads', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.NOTION_TOKEN}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({})
    });

    if (!createResponse.ok) {
      throw new Error(`Create upload failed: ${createResponse.status}`);
    }

    const uploadInfo = await createResponse.json();
    console.log(`  Upload ID: ${uploadInfo.id}`);

    // 步骤2: 上传文件内容
    const fileStream = fs.createReadStream(filePath);
    const form = new FormData();
    form.append('file', fileStream, { filename: fileName });

    const uploadResponse = await fetch(uploadInfo.upload_url, {
      method: 'POST',
      body: form,
      headers: {
        'Authorization': `Bearer ${process.env.NOTION_TOKEN}`,
        'Notion-Version': '2022-06-28'
      }
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      throw new Error(`Upload failed: ${uploadResponse.status} - ${errorText}`);
    }

    const uploadResult = await uploadResponse.json();
    console.log(`  Uploaded successfully: ${fileName}`);
    return uploadResult.id;

  } catch (error) {
    console.error(`  Error uploading ${fileName}:`, error.message);
    return null;
  }
}

async function createImageBlock(fileUploadId) {
  return [{
    object: 'block',
    type: 'image',
    image: {
      type: 'file_upload',
      file_upload: { id: fileUploadId }
    }
  }];
}

async function createFileBlock(fileUploadId, fileName) {
  return [{
    object: 'block',
    type: 'file',
    file: {
      type: 'file_upload',
      file_upload: { id: fileUploadId },
      caption: [{ type: 'text', text: { content: fileName } }]
    }
  }];
}

// ========== 原有功能 ==========
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
  const normalizedLang = normalizeLanguage(language);
  for (let i = 0; i < content.length; i += maxChunkSize) {
    blocks.push({
      object: 'block', type: 'code',
      code: { rich_text: [{ type: 'text', text: { content: content.slice(i, i + maxChunkSize) } }], language: normalizedLang }
    });
  }
  return blocks;
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

async function syncFile(filePath) {
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
    // Markdown 文件
    const content = fs.readFileSync(filePath, 'utf-8');
    blocks = markdownToNotionBlocks(content);
    syncType = 'markdown';
    icon = '📝';
  } else if (CODE_EXTENSIONS[ext]) {
    // 代码文件
    const content = fs.readFileSync(filePath, 'utf-8');
    blocks = codeFileToNotionBlocks(content, CODE_EXTENSIONS[ext]);
    syncType = 'code';
    icon = '💻';
  } else if (IMAGE_EXTENSIONS.includes(ext)) {
    // 图片文件 - 直接上传到Notion
    const fileUploadId = await uploadFileToNotion(filePath);
    if (fileUploadId) {
      blocks = await createImageBlock(fileUploadId);
      syncType = 'image';
      icon = '🖼️';
    } else {
      console.log(`  Skipped image: ${fileName}`);
      return;
    }
  } else if (DOCUMENT_EXTENSIONS.includes(ext)) {
    // 文档文件 - 作为文件附件上传
    const fileUploadId = await uploadFileToNotion(filePath);
    if (fileUploadId) {
      blocks = await createFileBlock(fileUploadId, fileName);
      syncType = 'document';
      icon = '📎';
    } else {
      console.log(`  Skipped document: ${fileName}`);
      return;
    }
  } else {
    // 其他文件 - 创建说明块
    blocks = [{ 
      object: 'block', 
      type: 'paragraph', 
      paragraph: { 
        rich_text: [{ 
          type: 'text', 
          text: { content: `文件: ${fileName} (${ext} 格式暂不支持预览)` } 
        }] 
      } 
    }];
    syncType = 'other';
    icon = '📄';
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

  let allFiles = [];
  for (const dir of SYNC_DIRS) {
    allFiles = allFiles.concat(getAllFiles(dir));
  }
  allFiles = [...new Set(allFiles)];

  console.log(`Found ${allFiles.length} files to sync`);

  for (const filePath of allFiles) {
    try {
      await syncFile(filePath);
    } catch (error) {
      console.error(`Error syncing ${filePath}:`, error.message);
    }
  }
  console.log('Sync completed!');
}

main();