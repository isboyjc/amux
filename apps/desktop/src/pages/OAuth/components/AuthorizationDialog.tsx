/**
 * Authorization Dialog Component
 * 
 * Modal for OAuth authorization with copy link functionality
 */

import { useState } from 'react'
import { ExternalLink, Copy, Check, Loader2 } from 'lucide-react'

import { CodexIcon, AntigravityIcon } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Modal, ModalHeader, ModalContent, ModalFooter } from '@/components/ui/modal'
import { useI18n } from '@/stores/i18n-store'
import type { OAuthProviderType } from '@/types/oauth'

interface AuthorizationDialogProps {
  open: boolean
  onClose: () => void
  providerType: OAuthProviderType
  authUrl: string | null
  isLoading: boolean
  onAuthorize: () => void
}

export function AuthorizationDialog({
  open,
  onClose,
  providerType,
  authUrl,
  isLoading,
  onAuthorize
}: AuthorizationDialogProps) {
  const [copied, setCopied] = useState(false)
  const { t } = useI18n()

  const providerInfo = {
    codex: {
      name: t('oauth.codex'),
      subtitle: t('oauth.openai'),
      icon: CodexIcon,
      description: t('oauth.authorization.codexDesc')
    },
    antigravity: {
      name: t('oauth.antigravity'),
      subtitle: t('oauth.google'),
      icon: AntigravityIcon,
      description: t('oauth.authorization.antigravityDesc')
    }
  }

  const info = providerInfo[providerType]
  const IconComponent = info.icon

  const handleCopy = async () => {
    if (authUrl) {
      await navigator.clipboard.writeText(authUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleStartAuth = () => {
    // 调用父组件的授权处理函数
    // 后端会打开浏览器并处理回调
    onAuthorize()
  }

  return (
    <Modal open={open} onClose={onClose} className="w-full max-w-2xl">
      <ModalHeader onClose={onClose}>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <IconComponent className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">
              {t('oauth.authorization.title').replace('{name}', info.name)}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {info.subtitle}
            </p>
          </div>
        </div>
      </ModalHeader>

      <ModalContent className="space-y-4">
        {/* Description */}
        <p className="text-sm text-muted-foreground">
          {info.description}
        </p>

        {/* Authorization URL */}
        {authUrl && (
          <div className="space-y-2">
            <Label htmlFor="auth-url" className="text-sm">
              {t('oauth.authorization.authUrl')}
            </Label>
            <div className="flex gap-2">
              <Input
                id="auth-url"
                value={authUrl}
                readOnly
                className="font-mono text-xs h-9"
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleCopy}
                className="flex-shrink-0 h-9"
              >
                {copied ? (
                  <>
                    <Check className="h-4 w-4 mr-1" />
                    {t('common.copied')}
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4 mr-1" />
                    {t('common.copy')}
                  </>
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {t('oauth.authorization.authUrlHint')}
            </p>
          </div>
        )}

        {/* Instructions */}
        <div className="bg-muted/50 rounded-lg p-4 space-y-2">
          <h4 className="text-sm font-medium">{t('oauth.authorization.steps')}</h4>
          <ol className="text-xs text-muted-foreground space-y-1.5 list-decimal list-inside">
            <li>{t('oauth.authorization.step1')}</li>
            <li>{t('oauth.authorization.step2').replace('{provider}', info.subtitle)}</li>
            <li>{t('oauth.authorization.step3')}</li>
            <li>{t('oauth.authorization.step4')}</li>
          </ol>
        </div>
      </ModalContent>

      <ModalFooter>
        <Button
          variant="outline"
          size="sm"
          onClick={onClose}
          disabled={isLoading}
        >
          {t('common.cancel')}
        </Button>
        <Button
          size="sm"
          onClick={handleStartAuth}
          disabled={isLoading || !authUrl}
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t('oauth.authorization.authorizing')}
            </>
          ) : (
            <>
              <ExternalLink className="mr-2 h-4 w-4" />
              {t('oauth.authorization.startAuth')}
            </>
          )}
        </Button>
      </ModalFooter>
    </Modal>
  )
}
