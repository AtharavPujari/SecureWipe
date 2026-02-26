import { NextRequest, NextResponse } from 'next/server'

// Default settings configuration
const defaultSettings = {
  wipe: {
    defaultMethod: 'nist_800_88',
    verificationLevel: 'full',
    autoVerify: true,
    retries: 3,
    timeout: 3600 // seconds
  },
  certificates: {
    autoGenerate: true,
    formats: ['pdf', 'json'],
    includeDeviceDetails: true,
    includeComplianceInfo: true,
    digitalSignature: true,
    thirdPartyVerification: false
  },
  audit: {
    enabled: true,
    logLevel: 'info',
    retainDays: 365,
    autoExport: false,
    exportFormat: 'json',
    complianceStandards: ['NIST-800-88', 'GDPR', 'HIPAA', 'PCI-DSS']
  },
  security: {
    requireConfirmation: true,
    allowParallelWipes: false,
    maxConcurrentOperations: 1,
    encryptionEnabled: true,
    secureEraseOnly: true
  },
  ui: {
    theme: 'system',
    language: 'en',
    showAdvancedOptions: false,
    autoRefresh: true,
    refreshInterval: 30
  }
}

// In-memory settings storage (in production, use a database)
let settings = { ...defaultSettings }

export async function GET() {
  try {
    return NextResponse.json({
      success: true,
      settings,
      lastModified: new Date().toISOString()
    })
  } catch (error) {
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to retrieve settings',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { category, updates } = await request.json()
    
    if (!category || !updates) {
      return NextResponse.json(
        { success: false, error: 'Category and updates are required' },
        { status: 400 }
      )
    }

    if (!settings[category as keyof typeof settings]) {
      return NextResponse.json(
        { success: false, error: 'Invalid settings category' },
        { status: 400 }
      )
    }

    // Validate updates
    const validation = validateSettingsUpdate(category, updates)
    if (!validation.valid) {
      return NextResponse.json(
        { success: false, error: 'Invalid settings', details: validation.errors },
        { status: 400 }
      )
    }

    // Update settings
    settings[category as keyof typeof settings] = {
      ...settings[category as keyof typeof settings],
      ...updates
    }

    // Log settings change
    await logSettingsChange(category, updates)

    return NextResponse.json({
      success: true,
      settings: settings[category as keyof typeof settings],
      message: 'Settings updated successfully'
    })

  } catch (error) {
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to update settings',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const { action } = await request.json()

    switch (action) {
      case 'reset':
        settings = { ...defaultSettings }
        await logSettingsChange('system', { action: 'reset_to_defaults' })
        
        return NextResponse.json({
          success: true,
          settings,
          message: 'Settings reset to defaults'
        })

      case 'export':
        const exportData = {
          exportedAt: new Date().toISOString(),
          version: '1.0',
          settings
        }

        return NextResponse.json({
          success: true,
          exportData,
          message: 'Settings exported successfully'
        })

      case 'import':
        const { importData } = await request.json()
        
        if (!importData || !importData.settings) {
          return NextResponse.json(
            { success: false, error: 'Invalid import data' },
            { status: 400 }
          )
        }

        // Validate imported settings
        const validation = validateAllSettings(importData.settings)
        if (!validation.valid) {
          return NextResponse.json(
            { success: false, error: 'Invalid settings in import data', details: validation.errors },
            { status: 400 }
          )
        }

        settings = { ...importData.settings }
        await logSettingsChange('system', { action: 'imported_settings' })

        return NextResponse.json({
          success: true,
          settings,
          message: 'Settings imported successfully'
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
        error: 'Failed to process settings action',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

function validateSettingsUpdate(category: string, updates: any): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  switch (category) {
    case 'wipe':
      if (updates.defaultMethod && !['nist_800_88', 'dod_5220', 'gutmann', 'zero_fill'].includes(updates.defaultMethod)) {
        errors.push('Invalid wipe method')
      }
      if (updates.verificationLevel && !['basic', 'full', 'enhanced'].includes(updates.verificationLevel)) {
        errors.push('Invalid verification level')
      }
      if (updates.retries !== undefined && (typeof updates.retries !== 'number' || updates.retries < 0 || updates.retries > 10)) {
        errors.push('Retries must be between 0 and 10')
      }
      break

    case 'certificates':
      if (updates.formats && !Array.isArray(updates.formats)) {
        errors.push('Certificate formats must be an array')
      }
      if (updates.formats && updates.formats.some((f: string) => !['pdf', 'json'].includes(f))) {
        errors.push('Invalid certificate format')
      }
      break

    case 'audit':
      if (updates.logLevel && !['error', 'warn', 'info', 'debug'].includes(updates.logLevel)) {
        errors.push('Invalid log level')
      }
      if (updates.retainDays !== undefined && (typeof updates.retainDays !== 'number' || updates.retainDays < 1 || updates.retainDays > 3650)) {
        errors.push('Retain days must be between 1 and 3650')
      }
      break

    case 'security':
      if (updates.maxConcurrentOperations !== undefined && (typeof updates.maxConcurrentOperations !== 'number' || updates.maxConcurrentOperations < 1 || updates.maxConcurrentOperations > 10)) {
        errors.push('Max concurrent operations must be between 1 and 10')
      }
      break

    case 'ui':
      if (updates.theme && !['light', 'dark', 'system'].includes(updates.theme)) {
        errors.push('Invalid theme')
      }
      if (updates.refreshInterval !== undefined && (typeof updates.refreshInterval !== 'number' || updates.refreshInterval < 5 || updates.refreshInterval > 300)) {
        errors.push('Refresh interval must be between 5 and 300 seconds')
      }
      break
  }

  return { valid: errors.length === 0, errors }
}

function validateAllSettings(settingsToValidate: any): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  for (const category in settingsToValidate) {
    const validation = validateSettingsUpdate(category, settingsToValidate[category])
    errors.push(...validation.errors)
  }

  return { valid: errors.length === 0, errors }
}

async function logSettingsChange(category: string, updates: any) {
  try {
    await fetch('/api/audit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'settings_changed',
        resource: 'configuration',
        resourceId: category,
        details: updates,
        result: 'success',
        complianceCategory: ['ISO-27001', 'SOX']
      })
    })
  } catch (error) {
    console.error('Failed to log settings change:', error)
  }
}