/**
 * Code Switch Page
 * 支持多 CLI（Claude Code, Codex）独立管理和热切换
 */

import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CliConfigPanel } from './cli-config-panel'
import type { CliType } from '@/types'

const CLI_CONFIGS = [
  {
    type: 'claude' as CliType,
    name: 'Claude Code',
    logo: '/icons/claude.png', // TODO: 添加实际 logo
    description: 'Anthropic Claude Code CLI',
  },
  {
    type: 'codex' as CliType,
    name: 'Codex',
    logo: '/icons/codex.png', // TODO: 添加实际 logo
    description: 'Codex CLI for AI-powered coding',
  },
]

export default function CodeSwitch() {
  const [activeTab, setActiveTab] = useState<CliType>('claude')

  return (
    <div className="h-full flex animate-fade-in gap-3">
      <div className="content-card flex-1 flex flex-col overflow-hidden">
        {/* Header Section */}
        <div className="p-6 pb-5 border-b shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold">Code Switch</h1>
              <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                为不同的 CLI 工具配置供应商和模型映射，支持热切换
              </p>
            </div>
          </div>
        </div>

        {/* CLI Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as CliType)} className="flex-1 flex flex-col overflow-hidden">
          <div className="px-6 pt-4 shrink-0">
            <TabsList className="grid w-full grid-cols-2 max-w-md">
              {CLI_CONFIGS.map((cli) => (
                <TabsTrigger key={cli.type} value={cli.type} className="gap-2">
                  {cli.logo && (
                    <img 
                      src={cli.logo} 
                      alt={cli.name} 
                      className="w-4 h-4 rounded"
                      onError={(e) => {
                        // 如果图片加载失败，隐藏它
                        e.currentTarget.style.display = 'none'
                      }}
                    />
                  )}
                  <span>{cli.name}</span>
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          {/* CLI Config Panels */}
          <div className="flex-1 overflow-hidden">
            {CLI_CONFIGS.map((cli) => (
              <TabsContent 
                key={cli.type} 
                value={cli.type}
                className="h-full mt-0 data-[state=active]:flex data-[state=active]:flex-col"
              >
                <CliConfigPanel cliType={cli.type} cliName={cli.name} />
              </TabsContent>
            ))}
          </div>
        </Tabs>
      </div>
    </div>
  )
}
