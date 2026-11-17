import { PipMark, PipWordmark } from '@/components/brand/PipLogo'
import { Card, CardContent } from '@/components/ui/card'

/** Centered card with the pip logo, shared by login, sign-up and invite pages. */
export function AuthShell({ subtitle, children, footer }: { subtitle: string; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-10 relative overflow-hidden">
      <div className="w-full max-w-sm relative">
        <div className="mb-8 text-center">
          <div className="flex flex-col items-center gap-3 mb-3">
            <PipMark size={44} />
            <PipWordmark height={30} className="text-foreground" />
          </div>
          <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
        </div>
        <Card className="shadow-xl border-border/50 bg-card/80 backdrop-blur-sm">
          <CardContent className="pt-6">{children}</CardContent>
        </Card>
        {footer && <div className="mt-4 text-center text-sm text-muted-foreground">{footer}</div>}
      </div>
    </div>
  )
}
