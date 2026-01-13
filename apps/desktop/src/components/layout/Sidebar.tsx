import { useRef } from 'react'
import { NavLink, useLocation } from 'react-router-dom'

import {
  Logo,
  GaugeIcon,
  GithubIcon,
  GearIcon,
  RocketIcon,
  KeyframesIcon,
  TerminalIcon,
  TunnelIcon
} from '@/components/icons'
import type { AnimatedIconHandle } from '@/components/icons'
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip'
import { ipc } from '@/lib/ipc'
import { cn } from '@/lib/utils'
import { useI18n } from '@/stores/i18n-store'

interface NavItemData {
  to: string
  icon: React.ForwardRefExoticComponent<any>
  labelKey: string
}

const navItems: NavItemData[] = [
  { to: '/', icon: GaugeIcon, labelKey: 'nav.dashboard' },
  { to: '/providers', icon: KeyframesIcon, labelKey: 'nav.providers' },
  { to: '/proxies', icon: RocketIcon, labelKey: 'nav.proxies' },
  { to: '/tunnel', icon: TunnelIcon, labelKey: 'nav.tunnel' },
  { to: '/logs', icon: TerminalIcon, labelKey: 'nav.logs' },
]

interface SidebarProps {
  collapsed: boolean
}

export function Sidebar({ collapsed }: SidebarProps) {
  const { t } = useI18n()
  const location = useLocation()
  const logoRef = useRef<AnimatedIconHandle>(null)
  
  const handleOpenGithub = () => {
    ipc.invoke('app:open-external', 'https://github.com/isboyjc/amux')
  }

  const handleLogoMouseEnter = () => {
    logoRef.current?.startAnimation()
  }

  const handleLogoMouseLeave = () => {
    logoRef.current?.stopAnimation()
  }

  return (
    <TooltipProvider delayDuration={0}>
      <div
        className={cn(
          'flex flex-col h-full transition-all duration-300 pb-3',
          collapsed ? 'w-[52px]' : 'w-44'
        )}
      >
        {/* Logo */}
        <div 
          className={cn(
            'flex items-center h-10 mb-1 px-2 cursor-pointer',
            collapsed && 'justify-center'
          )}
          onMouseEnter={handleLogoMouseEnter}
          onMouseLeave={handleLogoMouseLeave}
        >
          <div className={cn(
            'flex items-center h-8',
            collapsed ? 'justify-center' : 'w-8 justify-center'
          )}>
            <Logo ref={logoRef} size={22} color="currentColor" className="text-foreground" />
          </div>
          {!collapsed && (
            <span className="ml-3 font-bold text-[1.2rem] tracking-tight whitespace-nowrap">Amux</span>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-2">
          <div className="space-y-1">
            {navItems.map((item) => (
              <NavItem 
                key={item.to} 
                item={item} 
                collapsed={collapsed} 
                t={t}
                isActive={item.to === '/' ? location.pathname === '/' : location.pathname.startsWith(item.to)}
              />
            ))}
          </div>
        </nav>

        {/* Bottom - Settings & GitHub */}
        <div className="pt-2 border-t border-border/10 px-2">
          <div className="space-y-1">
            <NavItem 
              item={{ to: '/settings', icon: GearIcon, labelKey: 'nav.settings' }} 
              collapsed={collapsed}
              t={t}
              isActive={location.pathname === '/settings'}
            />
            
            {/* GitHub Button */}
            <GithubButton collapsed={collapsed} onClick={handleOpenGithub} />
          </div>
        </div>
      </div>
    </TooltipProvider>
  )
}

function GithubButton({ collapsed, onClick }: { collapsed: boolean; onClick: () => void }) {
  const iconRef = useRef<AnimatedIconHandle>(null)
  
  const handleMouseEnter = () => {
    iconRef.current?.startAnimation()
  }
  
  const handleMouseLeave = () => {
    iconRef.current?.stopAnimation()
  }

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className="w-full h-8 flex items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground hover:bg-foreground/5 dark:hover:bg-foreground/10 cursor-pointer"
            onClick={onClick}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          >
            <GithubIcon ref={iconRef} size={16} />
          </div>
        </TooltipTrigger>
        <TooltipContent side="right" className="font-medium">
          GitHub
        </TooltipContent>
      </Tooltip>
    )
  }

  return (
    <div
      className="w-full h-8 flex items-center rounded-md text-sm font-medium text-muted-foreground transition-colors hover:text-foreground hover:bg-foreground/5 dark:hover:bg-foreground/10 cursor-pointer"
      onClick={onClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className="w-8 flex justify-center">
        <GithubIcon ref={iconRef} size={16} />
      </div>
      <span className="ml-3 whitespace-nowrap">GitHub</span>
    </div>
  )
}

function NavItem({ 
  item, 
  collapsed, 
  t,
  isActive
}: { 
  item: NavItemData
  collapsed: boolean
  t: (key: string) => string
  isActive: boolean
}) {
  const Icon = item.icon
  const label = t(item.labelKey)
  const iconRef = useRef<AnimatedIconHandle>(null)
  
  const handleMouseEnter = () => {
    iconRef.current?.startAnimation()
  }
  
  const handleMouseLeave = () => {
    iconRef.current?.stopAnimation()
  }

  // Use same light background for selected and hover, slightly brighter in dark mode
  const selectedClass = 'bg-foreground/5 dark:bg-foreground/10 text-foreground'
  const unselectedClass = 'text-muted-foreground hover:text-foreground hover:bg-foreground/5 dark:hover:bg-foreground/10'

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              'w-full h-8 flex items-center justify-center rounded-md transition-colors cursor-pointer',
              isActive ? selectedClass : unselectedClass
            )}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          >
            <NavLink to={item.to} className="flex items-center justify-center w-full h-full">
              <Icon 
                ref={iconRef}
                size={16} 
                color={isActive ? 'hsl(var(--foreground))' : 'hsl(var(--muted-foreground))'} 
              />
            </NavLink>
          </div>
        </TooltipTrigger>
        <TooltipContent side="right" className="font-medium">
          {label}
        </TooltipContent>
      </Tooltip>
    )
  }

  return (
    <div
      className={cn(
        'w-full h-8 flex items-center rounded-md text-sm font-medium transition-colors cursor-pointer',
        isActive ? selectedClass : unselectedClass
      )}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <NavLink to={item.to} className="flex items-center w-full h-full">
        <div className="w-8 flex justify-center">
          <Icon 
            ref={iconRef}
            size={16} 
            color={isActive ? 'hsl(var(--foreground))' : 'hsl(var(--muted-foreground))'} 
          />
        </div>
        <span className="ml-3 whitespace-nowrap">{label}</span>
      </NavLink>
    </div>
  )
}
