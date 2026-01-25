import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {
    plugins: [
      externalizeDepsPlugin({
        // 不外部化 workspace 依赖，将它们打包进主进程
        exclude: ['@amux.ai/llm-bridge', '@amux.ai/adapter-openai', '@amux.ai/adapter-anthropic', 
                  '@amux.ai/adapter-deepseek', '@amux.ai/adapter-moonshot', '@amux.ai/adapter-qwen',
                  '@amux.ai/adapter-google', '@amux.ai/adapter-zhipu']
      })
    ],
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'electron/main.ts')
        }
      }
    },
    resolve: {
      alias: {
        '@electron': resolve(__dirname, 'electron')
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'electron/preload.ts')
        }
      }
    }
  },
  renderer: {
    root: 'src',
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/index.html')
        }
      }
    },
    plugins: [react()],
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src')
      }
    }
  }
})
