"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Download, Search, Filter, RefreshCw, FileText, Database, Shield } from "lucide-react"

interface AuditLogEntry {
  id: string
  timestamp: string
  userId?: string
  sessionId: string
  action: string
  resource: string
  resourceId: string
  details: any
  ipAddress: string
  userAgent: string
  result: 'success' | 'failure' | 'error'
  errorMessage?: string
  complianceCategory: string[]
}

interface AuditLogViewerProps {
  className?: string
}

export function AuditLogViewer({ className }: AuditLogViewerProps) {
  const [logs, setLogs] = useState<AuditLogEntry[]>([])
  const [filteredLogs, setFilteredLogs] = useState<AuditLogEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalItems, setTotalItems] = useState(0)
  
  // Filter states
  const [searchTerm, setSearchTerm] = useState("")
  const [actionFilter, setActionFilter] = useState("")
  const [resourceFilter, setResourceFilter] = useState("")
  const [resultFilter, setResultFilter] = useState("")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")

  useEffect(() => {
    fetchAuditLogs()
  }, [page])

  useEffect(() => {
    filterLogs()
  }, [logs, searchTerm, actionFilter, resourceFilter, resultFilter, startDate, endDate])

  const fetchAuditLogs = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "50"
      })

      if (actionFilter) params.append('action', actionFilter)
      if (resourceFilter) params.append('resource', resourceFilter)
      if (resultFilter) params.append('result', resultFilter)
      if (startDate) params.append('startDate', startDate)
      if (endDate) params.append('endDate', endDate)

      const response = await fetch(`/api/audit?${params}`)
      const data = await response.json()
      
      if (data.success) {
        setLogs(data.logs)
        setFilteredLogs(data.logs)
        setTotalPages(data.pagination.totalPages)
        setTotalItems(data.pagination.totalItems)
      }
    } catch (error) {
      console.error('Failed to fetch audit logs:', error)
    } finally {
      setLoading(false)
    }
  }

  const filterLogs = () => {
    let filtered = logs

    if (searchTerm) {
      filtered = filtered.filter(log => 
        log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.resource.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.resourceId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.details?.toString().toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    setFilteredLogs(filtered)
  }

  const exportLogs = async (format: 'csv' | 'json' | 'pdf') => {
    try {
      const params = new URLSearchParams({
        export: format
      })

      if (actionFilter) params.append('action', actionFilter)
      if (resourceFilter) params.append('resource', resourceFilter)
      if (resultFilter) params.append('result', resultFilter)
      if (startDate) params.append('startDate', startDate)
      if (endDate) params.append('endDate', endDate)

      const response = await fetch(`/api/audit?${params}`)
      if (response.ok) {
        const blob = await response.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `audit-logs-${new Date().toISOString().split('T')[0]}.${format}`
        a.click()
        URL.revokeObjectURL(url)
      }
    } catch (error) {
      console.error('Failed to export audit logs:', error)
    }
  }

  const refreshLogs = async () => {
    setRefreshing(true)
    await fetchAuditLogs()
    setRefreshing(false)
  }

  const getResultBadgeVariant = (result: string) => {
    switch (result) {
      case 'success': return 'default'
      case 'failure': return 'secondary'
      case 'error': return 'destructive'
      default: return 'outline'
    }
  }

  const getActionIcon = (action: string) => {
    if (action.includes('wipe') || action.includes('erase')) return <Database className="h-4 w-4" />
    if (action.includes('certificate') || action.includes('verify')) return <Shield className="h-4 w-4" />
    if (action.includes('export') || action.includes('download')) return <Download className="h-4 w-4" />
    return <FileText className="h-4 w-4" />
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Audit Log Viewer</h2>
          <p className="text-muted-foreground">
            Complete audit trail of all system activities and compliance events
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={refreshLogs} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Select onValueChange={(value) => exportLogs(value as any)}>
            <SelectTrigger className="w-32">
              <Download className="h-4 w-4 mr-2" />
              Export
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="csv">CSV</SelectItem>
              <SelectItem value="json">JSON</SelectItem>
              <SelectItem value="pdf">PDF</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="search">Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Search logs..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Action</Label>
              <Select value={actionFilter} onValueChange={setActionFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All actions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All actions</SelectItem>
                  <SelectItem value="wipe_started">Wipe Started</SelectItem>
                  <SelectItem value="wipe_completed">Wipe Completed</SelectItem>
                  <SelectItem value="certificate_generated">Certificate Generated</SelectItem>
                  <SelectItem value="device_detected">Device Detected</SelectItem>
                  <SelectItem value="access_granted">Access Granted</SelectItem>
                  <SelectItem value="access_denied">Access Denied</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Resource</Label>
              <Select value={resourceFilter} onValueChange={setResourceFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All resources" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All resources</SelectItem>
                  <SelectItem value="device">Device</SelectItem>
                  <SelectItem value="certificate">Certificate</SelectItem>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="system">System</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Result</Label>
              <Select value={resultFilter} onValueChange={setResultFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All results" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All results</SelectItem>
                  <SelectItem value="success">Success</SelectItem>
                  <SelectItem value="failure">Failure</SelectItem>
                  <SelectItem value="error">Error</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator className="my-4" />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startDate">Start Date</Label>
              <Input
                id="startDate"
                type="datetime-local"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">End Date</Label>
              <Input
                id="endDate"
                type="datetime-local"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Audit Logs Table */}
      <Card>
        <CardHeader>
          <CardTitle>Audit Logs</CardTitle>
          <CardDescription>
            Showing {filteredLogs.length} of {totalItems} total entries
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Loading audit logs...</div>
          ) : (
            <>
              <ScrollArea className="h-96">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Timestamp</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Resource</TableHead>
                      <TableHead>Details</TableHead>
                      <TableHead>IP Address</TableHead>
                      <TableHead>Result</TableHead>
                      <TableHead>Compliance</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLogs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="font-mono text-sm">
                          {new Date(log.timestamp).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getActionIcon(log.action)}
                            <span className="capitalize">{log.action.replace('_', ' ')}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{log.resource}</div>
                            <div className="text-sm text-muted-foreground font-mono">
                              {log.resourceId}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm max-w-xs truncate">
                            {typeof log.details === 'object' 
                              ? JSON.stringify(log.details) 
                              : log.details?.toString() || 'N/A'}
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {log.ipAddress}
                        </TableCell>
                        <TableCell>
                          <Badge variant={getResultBadgeVariant(log.result)}>
                            {log.result}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {log.complianceCategory?.slice(0, 2).map((category) => (
                              <Badge key={category} variant="outline" className="text-xs">
                                {category}
                              </Badge>
                            ))}
                            {log.complianceCategory?.length > 2 && (
                              <Badge variant="outline" className="text-xs">
                                +{log.complianceCategory.length - 2}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <div className="text-sm text-muted-foreground">
                    Page {page} of {totalPages}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(Math.max(1, page - 1))}
                      disabled={page === 1}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(Math.min(totalPages, page + 1))}
                      disabled={page === totalPages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}