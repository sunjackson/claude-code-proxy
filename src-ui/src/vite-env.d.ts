/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly MODE: string
  readonly BASE_URL: string
  readonly PROD: boolean
  readonly DEV: boolean
  readonly SSR: boolean
  // 添加其他环境变量...
  [key: string]: any
}

interface ImportMeta {
  readonly env: ImportMetaEnv
  readonly hot?: import('vite/types/hot').ViteHotContext
}

// 为 NodeJS 命名空间添加定义
declare namespace NodeJS {
  type Timeout = ReturnType<typeof setTimeout>;
  type Immediate = ReturnType<typeof setImmediate>;
  type Timer = NodeJS.Timeout | NodeJS.Immediate;
}
