'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { clientBilling, clients } from '@/lib/api'
import { useAuthStore } from '@/stores/auth'
import { isAdmin, PAYMENT_METHOD_LABELS, type ClientBillingResponse, type ClientResponse, type PaymentMethod, type RateType } from '@/lib/types'

const selectClass = 'w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm outline-none focus:border-primary/50 [&>option]:bg-popover'

/** Edits a client's name, contact and start date; Admins also set the rate and payment method. */
export function ClientDetailsDialog({ client, billing, onClose }: {
  client: ClientResponse
  billing?: ClientBillingResponse
  onClose: () => void
}) {
  const { token, user } = useAuthStore()
  const admin = isAdmin(user?.role)
  const queryClient = useQueryClient()

  const [name, setName] = useState(client.name)
  const [contactEmail, setContactEmail] = useState(client.contactEmail ?? '')
  const [clientSince, setClientSince] = useState(client.clientSince ?? '')
  const [rateType, setRateType] = useState<RateType | ''>(billing?.rateType ?? '')
  const [rateAmount, setRateAmount] = useState(billing?.rateAmount != null ? String(billing.rateAmount) : '')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | ''>(billing?.paymentMethod ?? '')

  const saveMutation = useMutation({
    mutationFn: async () => {
      await clients.update(token!, client.clientId, {
        name: name.trim(),
        contactEmail: contactEmail.trim() || undefined,
        clientSince: clientSince || undefined,
      })
      if (admin) {
        await clientBilling.update(token!, client.clientId, {
          ...(rateType ? { rateType, rateAmount: Number(rateAmount) } : {}),
          ...(paymentMethod ? { paymentMethod } : {}),
        })
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] })
      queryClient.invalidateQueries({ queryKey: ['clients-with-retainer'] })
      queryClient.invalidateQueries({ queryKey: ['client-billing'] })
      toast.success('Client updated')
      onClose()
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const rateValid = !rateType || (rateAmount !== '' && Number(rateAmount) >= 0)
  const canSave = name.trim().length > 0 && rateValid && !saveMutation.isPending

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Client details</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Contact email <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Client since</Label>
            <Input type="date" value={clientSince} onChange={(e) => setClientSince(e.target.value)} />
          </div>

          {admin && (
            <div className="border-t border-border pt-4 space-y-4">
              <p className="text-xs text-muted-foreground">Rate and payment method are only visible to Admins.</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Rate</Label>
                  <select className={selectClass} value={rateType} onChange={(e) => setRateType(e.target.value as RateType | '')}>
                    <option value="">Not set</option>
                    <option value="HOURLY">Hourly rate</option>
                    <option value="MONTHLY">Monthly fee</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label>Amount (£)</Label>
                  <Input type="number" min="0" step="0.01" disabled={!rateType}
                    placeholder={rateType === 'MONTHLY' ? 'e.g. 1200' : 'e.g. 45'}
                    value={rateAmount} onChange={(e) => setRateAmount(e.target.value)} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Payment method</Label>
                <select className={selectClass} value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod | '')}>
                  <option value="">Not set</option>
                  {(Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[]).map((m) => (
                    <option key={m} value={m}>{PAYMENT_METHOD_LABELS[m]}</option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => saveMutation.mutate()} disabled={!canSave}>
            {saveMutation.isPending ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
