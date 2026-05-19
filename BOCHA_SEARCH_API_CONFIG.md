# 博查 Web Search API 配置指南

## 概述

本系统已添加对博查 Web Search API 的支持，该 API 兼容 Bing Search API 格式。

## API 配置

### 1. 搜索引擎选择

在 `WebSearch.svelte` 组件中，可以通过修改 `searchEngineConfig` 来切换搜索引擎：

```typescript
const searchEngineConfig: SearchEngineConfig = {
  engine: 'duckduckgo', // 可改为 'bocha'
  apiKey: undefined
}
```

### 2. 使用博查 API

要启用博查搜索，将配置修改为：

```typescript
const searchEngineConfig: SearchEngineConfig = {
  engine: 'bocha',
  apiKey: 'YOUR_BOCHA_API_KEY' // 替换为实际的 API Key
}
```

### 3. 自定义配置

博查 API 支持以下配置选项：

- `apiKey`: 博查 API 密钥（必需）
- `baseUrl`: API 端点地址（默认：`https://api.bochaai.com/api/v1/web-search`）
- `country`: 国家/地区代码（默认：`CN`）
- `language`: 语言代码（默认：`zh-CN`）

完整配置示例：

```typescript
const bochaConfig: BochaSearchConfig = {
  apiKey: 'YOUR_BOCHA_API_KEY',
  baseUrl: 'https://api.bochaai.com/api/v1/web-search',
  country: 'CN',
  language: 'zh-CN'
}

const searchAPI = new BochaSearchAPI(bochaConfig)
```

## API 返回格式

博查 API 返回的数据格式应如下：

```json
{
  "data": {
    "webPages": {
      "value": [
        {
          "name": "结果标题",
          "url": "https://example.com",
          "snippet": "结果摘要"
        }
      ]
    }
  }
}
```

或者兼容格式：

```json
{
  "results": [
    {
      "title": "结果标题",
      "url": "https://example.com"
    }
  ]
}
```

## 实现文件

- `/workspace/packages/web-parser/src/search/bocha.ts` - 博查 API 实现
- `/workspace/packages/web-parser/src/search/index.ts` - 导出配置
- `/workspace/app/src/renderer/Resource/components/WebSearch.svelte` - 搜索引擎使用

## 注意事项

1. 需要有效的博查 API 密钥才能使用
2. API 密钥应通过安全的方式存储和传递，不要硬编码在源代码中
3. 建议在生产环境中使用环境变量或配置文件管理 API 密钥
