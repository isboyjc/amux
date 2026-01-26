import { resolve } from 'path'
import { config } from 'dotenv'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

// 加载 .env 文件
config()

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
    define: {
      // 将环境变量注入到主进程
      'process.env.GA_MEASUREMENT_ID': JSON.stringify(process.env.GA_MEASUREMENT_ID),
      'process.env.GA_API_SECRET': JSON.stringify(process.env.GA_API_SECRET)
    },
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
