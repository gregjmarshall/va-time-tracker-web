'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { reports, clients } from '@/lib/api'
import { useAuthStore } from '@/stores/auth'

function formatHours(h: number) {
  return h % 1 === 0 ? `${h}h` : `${h.toFixed(1)}h`
}

function pct(n?: number) {
  if (n === undefined) return null
  return Math.round(n)
}

export default function ReportsPage() {
  const { token, user } = useAuthStore()
  const [tab, setTab] = useState('summary')

  const monthStart = dayjs().startOf('month').toISOString()
  const monthEnd = dayjs().endOf('month').toISOString()

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['reports-summary', token, monthStart],
    queryFn: () => reports.summary(token!, { from: monthStart, to: monthEnd }),
    enabled: !!token,
  })

  const { data: retainerReport, isLoading: retainerLoading } = useQuery({
    queryKey: ['reports-retainer', token],
    queryFn: () => reports.retainer(token!),
    enabled: !!token && user?.role === 'MANAGER',
  })

  const { data: clientList = [] } = useQuery({
    queryKey: ['clients', token],
    queryFn: () => clients.list(token!),
    enabled: !!token,
  })

  function handleExportCsv() {
    window.open(`/api/reports/export/spreadsheet?year=${dayjs().year()}`, '_blank')
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Reports</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{dayjs().format('MMMM YYYY')}</p>
        </div>
        {user?.role === 'MANAGER' && (
          <Button variant="outline" size="sm" onClick={handleExportCsv}>
            Export CSV
          </Button>
        )}
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="summary">Summary</TabsTrigger>
          {user?.role === 'MANAGER' && <TabsTrigger value="retainers">Retainers</TabsTrigger>}
        </TabsList>

        <TabsContent value="summary">
          {summaryLoading ? (
            <div className="text-center py-12 text-muted-foreground text-sm">Loading…</div>
          ) : (
            <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Client</TableHead>
                    <TableHead>Project</TableHead>
                    <TableHead className="text-right">Hours</TableHead>
                    <TableHead className="text-right">Rounded</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(summary?.rows ?? []).length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                        No entries this month
                      </TableCell>
                    </TableRow>
                  )}
                  {(summary?.rows ?? []).map((row) => (
                    <TableRow key={`${row.clientId}-${row.projectId}`}>
                      <TableCell className="font-medium">{row.clientName}</TableCell>
                      <TableCell className="text-muted-foreground">{row.projectName}</TableCell>
                      <TableCell className="text-right font-mono">{formatHours(row.totalHours)}</TableCell>
                      <TableCell className="text-right font-mono text-muted-foreground">{formatHours(row.roundedTotalHours)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {user?.role === 'MANAGER' && (
          <TabsContent value="retainers">
            {retainerLoading ? (
              <div className="text-center py-12 text-muted-foreground text-sm">Loading…</div>
            ) : (
              <div className="space-y-4">
                {(retainerReport?.rows ?? []).length === 0 && (
                  <p className="text-center py-12 text-muted-foreground text-sm">No retainer data</p>
                )}
                {(retainerReport?.rows ?? []).map((row) => {
                  const used = pct(row.percentUsed) ?? 0
                  return (
                    <Card key={row.clientId} className="shadow-sm">
                      <CardContent className="pt-5 pb-5">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <p className="font-semibold text-foreground">{row.clientName}</p>
                            <p className="text-sm text-muted-foreground mt-0.5">
                              {formatHours(row.actualHours)} used
                              {row.retainerHours ? ` of ${formatHours(row.retainerHours)}` : ''}
                            </p>
                          </div>
                          <Badge variant={row.isOver ? 'destructive' : 'secondary'}>
                            {row.isOver ? 'Over' : used > 80 ? 'Near limit' : 'On track'}
                          </Badge>
                        </div>
                        {row.retainerHours && (
                          <div className="space-y-1">
                            <Progress
                              value={Math.min(used, 100)}
                              className={row.isOver ? '[&>div]:bg-destructive' : used > 80 ? '[&>div]:bg-amber-500' : ''}
                            />
                            <p className="text-xs text-muted-foreground text-right">{used}%</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            )}
          </TabsContent>
        )}
      </Tabs>
    </div>
  )
}
