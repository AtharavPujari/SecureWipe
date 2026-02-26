import { NextRequest, NextResponse } from 'next/server'

// Mock audit log storage
const auditLogs: any[] = []

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

export async function POST(request: NextRequest) {
  try {
    const {
      action,
      resource,
      resourceId,
      details = {},
      result = 'success',
      errorMessage,
      complianceCategory = []
    } = await request.json()

    if (!action || !resource || !resourceId) {
      return NextResponse.json(
        { success: false, error: 'Action, resource, and resourceId are required' },
        { status: 400 }
      )
    }

    // Get client information
    const ipAddress = request.headers.get('x-forwarded-for') || 'unknown'
    const userAgent = request.headers.get('user-agent') || 'unknown'
    const sessionId = request.headers.get('x-session-id') || `session-${Date.now()}`

    // Create audit log entry
    const auditEntry: AuditLogEntry = {
      id: `audit-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      timestamp: new Date().toISOString(),
      sessionId,
      action,
      resource,
      resourceId,
      details,
      ipAddress,
      userAgent,
      result,
      errorMessage,
      complianceCategory: complianceCategory.length > 0 ? complianceCategory : getDefaultComplianceCategory(action)
    }

    // Store the audit log
    auditLogs.push(auditEntry)

    // In production, this would also:
    // - Write to a persistent database
    // - Send to external audit systems
    // - Create blockchain entries for immutable records
    // - Trigger compliance alerts if needed

    return NextResponse.json({
      success: true,
      auditId: auditEntry.id,
      message: 'Audit log entry created successfully'
    })

  } catch (error) {
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to create audit log entry',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const action = searchParams.get('action')
    const resource = searchParams.get('resource')
    const resourceId = searchParams.get('resourceId')
    const result = searchParams.get('result')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const exportFormat = searchParams.get('export')

    // Filter logs based on query parameters
    let filteredLogs = [...auditLogs]

    if (action) {
      filteredLogs = filteredLogs.filter(log => log.action === action)
    }

    if (resource) {
      filteredLogs = filteredLogs.filter(log => log.resource === resource)
    }

    if (resourceId) {
      filteredLogs = filteredLogs.filter(log => log.resourceId === resourceId)
    }

    if (result) {
      filteredLogs = filteredLogs.filter(log => log.result === result)
    }

    if (startDate) {
      const start = new Date(startDate)
      filteredLogs = filteredLogs.filter(log => new Date(log.timestamp) >= start)
    }

    if (endDate) {
      const end = new Date(endDate)
      filteredLogs = filteredLogs.filter(log => new Date(log.timestamp) <= end)
    }

    // Sort by timestamp (newest first)
    filteredLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

    // Pagination
    const startIndex = (page - 1) * limit
    const endIndex = startIndex + limit
    const paginatedLogs = filteredLogs.slice(startIndex, endIndex)

    // Handle export formats
    if (exportFormat) {
      switch (exportFormat) {
        case 'csv':
          return exportAsCSV(filteredLogs)
        case 'json':
          return exportAsJSON(filteredLogs)
        case 'pdf':
          return exportAsPDF(filteredLogs)
        default:
          return NextResponse.json(
            { success: false, error: 'Unsupported export format' },
            { status: 400 }
          )
      }
    }

    return NextResponse.json({
      success: true,
      logs: paginatedLogs,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(filteredLogs.length / limit),
        totalItems: filteredLogs.length,
        itemsPerPage: limit
      },
      summary: generateAuditSummary(filteredLogs)
    })

  } catch (error) {
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to retrieve audit logs',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { logId, action, data } = await request.json()

    if (!logId || !action) {
      return NextResponse.json(
        { success: false, error: 'Log ID and action are required' },
        { status: 400 }
      )
    }

    const logIndex = auditLogs.findIndex(log => log.id === logId)
    if (logIndex === -1) {
      return NextResponse.json(
        { success: false, error: 'Audit log not found' },
        { status: 404 }
      )
    }

    switch (action) {
      case 'verify':
        // Verify log integrity
        const verificationResult = verifyLogIntegrity(auditLogs[logIndex])
        return NextResponse.json({
          success: true,
          verified: verificationResult.valid,
          details: verificationResult.details
        })

      case 'archive':
        // Archive log (in production, move to cold storage)
        auditLogs[logIndex].archived = true
        auditLogs[logIndex].archivedAt = new Date().toISOString()
        return NextResponse.json({
          success: true,
          message: 'Audit log archived successfully'
        })

      case 'add_compliance_note':
        // Add compliance note
        if (!data?.note) {
          return NextResponse.json(
            { success: false, error: 'Compliance note is required' },
            { status: 400 }
          )
        }
        
        if (!auditLogs[logIndex].complianceNotes) {
          auditLogs[logIndex].complianceNotes = []
        }
        
        auditLogs[logIndex].complianceNotes.push({
          note: data.note,
          timestamp: new Date().toISOString(),
          author: data.author || 'System'
        })
        
        return NextResponse.json({
          success: true,
          message: 'Compliance note added successfully'
        })

      default:
        return NextResponse.json(
          { success: false, error: 'Unknown action' },
          { status: 400 }
        )
    }

  } catch (error) {
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to process audit log action',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

function getDefaultComplianceCategory(action: string): string[] {
  const categoryMap: Record<string, string[]> = {
    'device_detected': ['GDPR', 'HIPAA', 'PCI-DSS'],
    'wipe_started': ['NIST-800-88', 'ISO-27040', 'GDPR'],
    'wipe_completed': ['NIST-800-88', 'ISO-27040', 'GDPR', 'HIPAA'],
    'certificate_generated': ['GDPR', 'HIPAA', 'PCI-DSS', 'SOX'],
    'certificate_verified': ['GDPR', 'HIPAA', 'PCI-DSS'],
    'access_granted': ['GDPR', 'HIPAA', 'SOX'],
    'access_denied': ['GDPR', 'HIPAA', 'SOX'],
    'configuration_changed': ['ISO-27001', 'SOX'],
    'error_occurred': ['ISO-27001', 'SOX']
  }

  return categoryMap[action] || ['General']
}

function generateAuditSummary(logs: any[]): any {
  const summary = {
    totalLogs: logs.length,
    actions: {} as Record<string, number>,
    resources: {} as Record<string, number>,
    results: {} as Record<string, number>,
    complianceCategories: {} as Record<string, number>,
    timeRange: {
      earliest: logs.length > 0 ? logs[logs.length - 1]?.timestamp : null,
      latest: logs.length > 0 ? logs[0]?.timestamp : null
    }
  }

  logs.forEach(log => {
    // Count actions
    summary.actions[log.action] = (summary.actions[log.action] || 0) + 1
    
    // Count resources
    summary.resources[log.resource] = (summary.resources[log.resource] || 0) + 1
    
    // Count results
    summary.results[log.result] = (summary.results[log.result] || 0) + 1
    
    // Count compliance categories
    log.complianceCategory?.forEach((category: string) => {
      summary.complianceCategories[category] = (summary.complianceCategories[category] || 0) + 1
    })
  })

  return summary
}

function verifyLogIntegrity(log: any): { valid: boolean, details: string[] } {
  const details: string[] = []
  let isValid = true

  // Check required fields
  const requiredFields = ['id', 'timestamp', 'action', 'resource', 'resourceId', 'result']
  for (const field of requiredFields) {
    if (!log[field]) {
      isValid = false
      details.push(`Missing required field: ${field}`)
    }
  }

  // Check timestamp format
  if (log.timestamp && isNaN(Date.parse(log.timestamp))) {
    isValid = false
    details.push('Invalid timestamp format')
  }

  // Check result value
  const validResults = ['success', 'failure', 'error']
  if (log.result && !validResults.includes(log.result)) {
    isValid = false
    details.push('Invalid result value')
  }

  if (isValid) {
    details.push('Log integrity verified successfully')
  }

  return { valid: isValid, details }
}

function exportAsCSV(logs: any[]): NextResponse {
  const headers = [
    'ID', 'Timestamp', 'Action', 'Resource', 'Resource ID', 
    'Result', 'IP Address', 'User Agent', 'Compliance Categories'
  ]

  const csvContent = [
    headers.join(','),
    ...logs.map(log => [
      log.id,
      log.timestamp,
      log.action,
      log.resource,
      log.resourceId,
      log.result,
      log.ipAddress,
      `"${log.userAgent}"`,
      log.complianceCategory?.join(';') || ''
    ].join(','))
  ].join('\n')

  return new NextResponse(csvContent, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="audit-logs-${Date.now()}.csv"`
    }
  })
}

function exportAsJSON(logs: any[]): NextResponse {
  const exportData = {
    exportedAt: new Date().toISOString(),
    totalLogs: logs.length,
    logs: logs
  }

  return new NextResponse(JSON.stringify(exportData, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="audit-logs-${Date.now()}.json"`
    }
  })
}

function exportAsPDF(logs: any[]): NextResponse {
  // Simplified PDF export - in production, use a proper PDF library
  const pdfContent = `
AUDIT LOG EXPORT
================

Exported: ${new Date().toISOString()}
Total Logs: ${logs.length}

LOG ENTRIES
-----------

${logs.map(log => `
ID: ${log.id}
Timestamp: ${log.timestamp}
Action: ${log.action}
Resource: ${log.resource}
Resource ID: ${log.resourceId}
Result: ${log.result}
IP Address: ${log.ipAddress}
Compliance: ${log.complianceCategory?.join(', ') || 'N/A'}
---
`).join('')}

This audit log export contains ${logs.length} entries and was generated 
for compliance and record-keeping purposes.
  `.trim()

  return new NextResponse(pdfContent, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="audit-logs-${Date.now()}.pdf"`
    }
  })
}