import { Play, Square, RefreshCw, Languages } from 'lucide-react'
import { useEffect, useRef } from 'react'

import { SidebarCollapseIcon, SidebarExpandIcon, MoonIcon, SunIcon } from '@/components/icons'
import type { AnimatedIconHandle } from '@/components/icons'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { useI18n } from '@/stores/i18n-store'
import { useProxyStore } from '@/stores/proxy-store'
import { useSettingsStore, getEffectiveTheme } from '@/stores/settings-store'

interface HeaderProps {
  sidebarCollapsed: boolean
  onToggleSidebar: () => void
}

export function Header({ sidebarCollapsed, onToggleSidebar }: HeaderProps) {
  const { status, port, host, start, stop, restart, fetchStatus } = useProxyStore()
  const { locale, setLocale, t } = useI18n()
  const { theme, setTheme } = useSettingsStore()
  const sidebarIconRef = useRef<AnimatedIconHandle>(null)
  const themeIconRef = useRef<AnimatedIconHandle>(null)

  useEffect(() => {
    fetchStatus()
    const interval = setInterval(fetchStatus, 5000)
    return () => clearInterval(interval)
  }, [fetchStatus])

  useEffect(() => {
    const applyTheme = () => {
      const effectiveTheme = getEffectiveTheme(theme)
      document.documentElement.classList.toggle('dark', effectiveTheme === 'dark')
    }

    applyTheme()

    // Listen for system theme changes when theme is 'system'
    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
      mediaQuery.addEventListener('change', applyTheme)
      return () => mediaQuery.removeEventListener('change', applyTheme)
    }
  }, [theme])

  const toggleTheme = () => {
    themeIconRef.current?.startAnimation()
    // Cycle: light -> dark -> system -> light
    if (theme === 'light') {
      setTheme('dark')
    } else if (theme === 'dark') {
      setTheme('system')
    } else {
      setTheme('light')
    }
  }

  const effectiveTheme = getEffectiveTheme(theme)

  const toggleLocale = () => {
    setLocale(locale === 'en-US' ? 'zh-CN' : 'en-US')
  }

  const handleSidebarToggle = () => {
    sidebarIconRef.current?.startAnimation()
    onToggleSidebar()
  }

  return (
    <TooltipProvider>
      {/* Height 38px to align with macOS traffic lights */}
      <header className="h-[38px] flex items-center justify-between px-3 drag-region">
        {/* Left side - Traffic light space + Sidebar toggle */}
        <div className="flex items-center no-drag">
          {/* Space for macOS traffic lights */}
          <div className="w-[64px]" />
          
          {/* Sidebar toggle button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-md hover:bg-foreground/5 dark:hover:bg-foreground/10 text-muted-foreground hover:text-foreground"
                onClick={handleSidebarToggle}
                onMouseEnter={() => sidebarIconRef.current?.startAnimation()}
                onMouseLeave={() => sidebarIconRef.current?.stopAnimation()}
              >
                {sidebarCollapsed ? (
                  <SidebarExpandIcon ref={sidebarIconRef} size={16} />
                ) : (
                  <SidebarCollapseIcon ref={sidebarIconRef} size={16} />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {sidebarCollapsed ? t('common.expand') : t('common.collapse')}
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Center - Service Status */}
        <div className="flex items-center gap-2 no-drag">
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-card border border-border/50">
            <div
              className={cn(
                'status-dot',
                status === 'running' && 'status-dot-running',
                status === 'stopped' && 'status-dot-stopped',
                status === 'error' && 'status-dot-error'
              )}
            />
            <span className="text-xs font-medium">
              {status === 'running' && t('service.running')}
              {status === 'stopped' && t('service.stopped')}
              {status === 'starting' && t('service.starting')}
              {status === 'stopping' && t('service.stopping')}
              {status === 'error' && t('service.error')}
            </span>
            {status === 'running' && port && (
              <Badge variant="secondary" className="text-[10px] font-mono px-1.5 py-0 h-4">
                {host}:{port}
              </Badge>
            )}
          </div>

          {/* Service Controls */}
          <div className="flex items-center gap-0.5">
            {status === 'running' ? (
              <>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 rounded-md hover:bg-foreground/5 dark:hover:bg-foreground/10"
                      onClick={() => stop()}
                    >
                      <Square className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{t('service.stop')}</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 rounded-md hover:bg-foreground/5 dark:hover:bg-foreground/10"
                      onClick={() => restart()}
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{t('service.restart')}</TooltipContent>
                </Tooltip>
              </>
            ) : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 rounded-md hover:bg-foreground/5 dark:hover:bg-foreground/10"
                    onClick={() => start()}
                    disabled={status === 'starting'}
                  >
                    <Play className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t('service.start')}</TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>

        {/* Right side - Language & Theme Toggle */}
        <div className="flex items-center gap-1 no-drag">
          {/* Language Toggle - Icon only */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-md hover:bg-foreground/5 dark:hover:bg-foreground/10"
                onClick={toggleLocale}
              >
                <Languages className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {locale === 'en-US' ? '切换到中文' : 'Switch to English'}
            </TooltipContent>
          </Tooltip>

          {/* Theme Toggle */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-md hover:bg-foreground/5 dark:hover:bg-foreground/10"
                onClick={toggleTheme}
                onMouseEnter={() => themeIconRef.current?.startAnimation()}
                onMouseLeave={() => themeIconRef.current?.stopAnimation()}
              >
                {effectiveTheme === 'light' ? (
                  <MoonIcon ref={themeIconRef} size={16} />
                ) : (
                  <SunIcon ref={themeIconRef} size={16} />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {theme === 'light' && t('common.darkMode')}
              {theme === 'dark' && t('common.systemMode')}
              {theme === 'system' && t('common.lightMode')}
            </TooltipContent>
          </Tooltip>
        </div>
      </header>
    </TooltipProvider>
  )
}
