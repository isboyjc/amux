import { Toaster as Sonner } from 'sonner'

import { useSettingsStore } from '@/stores'

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ ...props }: ToasterProps) => {
  const theme = useSettingsStore((state) => state.theme)

  return (
    <>
      <style>
        {`
          [data-sonner-toaster] [data-sonner-toast] {
            padding: 12px 16px !important;
            font-size: 13px !important;
            border-radius: 8px !important;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08) !important;
          }
          [data-sonner-toaster] [data-sonner-toast][data-type="success"] {
            background: #f0fdf4 !important;
            border: 1px solid #bbf7d0 !important;
            color: #15803d !important;
          }
          [data-sonner-toaster] [data-sonner-toast][data-type="error"] {
            background: #fef2f2 !important;
            border: 1px solid #fecaca !important;
            color: #dc2626 !important;
          }
          [data-sonner-toaster] [data-sonner-toast][data-type="warning"] {
            background: #fefce8 !important;
            border: 1px solid #fef08a !important;
            color: #a16207 !important;
          }
          [data-sonner-toaster] [data-sonner-toast][data-type="info"] {
            background: #eff6ff !important;
            border: 1px solid #bfdbfe !important;
            color: #1d4ed8 !important;
          }
          .dark [data-sonner-toaster] [data-sonner-toast][data-type="success"] {
            background: #052e16 !important;
            border: 1px solid #166534 !important;
            color: #4ade80 !important;
          }
          .dark [data-sonner-toaster] [data-sonner-toast][data-type="error"] {
            background: #2c0a0a !important;
            border: 1px solid #7f1d1d !important;
            color: #f87171 !important;
          }
          .dark [data-sonner-toaster] [data-sonner-toast][data-type="warning"] {
            background: #2a2305 !important;
            border: 1px solid #854d0e !important;
            color: #fbbf24 !important;
          }
          .dark [data-sonner-toaster] [data-sonner-toast][data-type="info"] {
            background: #0c1929 !important;
            border: 1px solid #1e40af !important;
            color: #60a5fa !important;
          }
          [data-sonner-toaster] [data-sonner-toast] [data-description] {
            font-size: 12px !important;
            opacity: 0.8 !important;
            margin-top: 2px !important;
          }
        `}
      </style>
      <Sonner
        theme={theme as ToasterProps['theme']}
        toastOptions={{
          duration: 2500,
        }}
        {...props}
      />
    </>
  )
}

export { Toaster }
