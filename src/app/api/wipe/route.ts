import { NextRequest, NextResponse } from 'next/server'

// Store active wipe operations in memory (in production, use a database)
const activeWipes = new Map<string, any>()
const wipeHistory: any[] = []

// Wipe methods configuration
const WIPE_METHODS = {
  nist_800_88: {
    name: "NIST SP 800-88 Purge",
    description: "NIST standard for media sanitization",
    passes: 1,
    verification: true,
    certification: true
  },
  dod_5220: {
    name: "DoD 5220.22-M",
    description: "Department of Defense standard",
    passes: 3,
    verification: true,
    certification: true
  },
  gutmann: {
    name: "Gutmann Method",
    description: "35-pass secure deletion",
    passes: 35,
    verification: true,
    certification: true
  },
  zero_fill: {
    name: "Zero Fill",
    description: "Single pass with zeros",
    passes: 1,
    verification: false,
    certification: false
  }
}

export async function POST(request: NextRequest) {
  try {
    const { deviceId, method, verificationLevel = 'full' } = await request.json()
    
    if (!deviceId || !method) {
      return NextResponse.json(
        { success: false, error: 'Device ID and wipe method are required' },
        { status: 400 }
      )
    }

    const wipeMethod = WIPE_METHODS[method as keyof typeof WIPE_METHODS]
    if (!wipeMethod) {
      return NextResponse.json(
        { success: false, error: 'Invalid wipe method' },
        { status: 400 }
      )
    }

    // Generate unique wipe operation ID
    const operationId = `wipe-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    
    // Create wipe operation
    const wipeOperation = {
      id: operationId,
      deviceId,
      method: wipeMethod.name,
      methodConfig: wipeMethod,
      verificationLevel,
      startTime: new Date().toISOString(),
      status: 'in_progress',
      progress: 0,
      currentPass: 0,
      totalPasses: wipeMethod.passes,
      estimatedDuration: estimateWipeDuration(deviceId, method),
      logs: []
    }

    // Store the operation
    activeWipes.set(operationId, wipeOperation)

    // Start the wipe process (simulated)
    startWipeProcess(operationId, deviceId, method)

    return NextResponse.json({
      success: true,
      operation: wipeOperation,
      message: 'Wipe operation started successfully'
    })

  } catch (error) {
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to start wipe operation',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const operationId = searchParams.get('id')

    if (operationId) {
      // Get specific operation
      const operation = activeWipes.get(operationId)
      if (!operation) {
        return NextResponse.json(
          { success: false, error: 'Operation not found' },
          { status: 404 }
        )
      }
      return NextResponse.json({ success: true, operation })
    }

    // Get all active operations
    const operations = Array.from(activeWipes.values())
    return NextResponse.json({ 
      success: true, 
      operations,
      activeCount: operations.length
    })

  } catch (error) {
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to retrieve wipe operations',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const operationId = searchParams.get('id')

    if (!operationId) {
      return NextResponse.json(
        { success: false, error: 'Operation ID is required' },
        { status: 400 }
      )
    }

    const operation = activeWipes.get(operationId)
    if (!operation) {
      return NextResponse.json(
        { success: false, error: 'Operation not found' },
        { status: 404 }
      )
    }

    // Cancel the operation
    operation.status = 'cancelled'
    operation.endTime = new Date().toISOString()
    
    // Move to history
    wipeHistory.push({ ...operation })
    activeWipes.delete(operationId)

    return NextResponse.json({
      success: true,
      message: 'Wipe operation cancelled successfully'
    })

  } catch (error) {
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to cancel wipe operation',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

function estimateWipeDuration(deviceId: string, method: string): string {
  // Mock estimation based on device size and method
  const methodConfig = WIPE_METHODS[method as keyof typeof WIPE_METHODS]
  const baseTime = 5 // minutes for base pass
  const totalTime = baseTime * methodConfig.passes
  
  if (totalTime < 60) {
    return `${totalTime} minutes`
  } else {
    return `${Math.round(totalTime / 60)} hours`
  }
}

async function startWipeProcess(operationId: string, deviceId: string, method: string) {
  const operation = activeWipes.get(operationId)
  if (!operation) return

  const methodConfig = WIPE_METHODS[method as keyof typeof WIPE_METHODS]
  const totalPasses = methodConfig.passes
  
  try {
    // Simulate wipe process
    for (let pass = 1; pass <= totalPasses; pass++) {
      if (!activeWipes.has(operationId)) break // Operation was cancelled
      
      operation.currentPass = pass
      operation.progress = (pass / totalPasses) * 100
      
      // Simulate pass execution time
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      // Add log entry
      operation.logs.push({
        timestamp: new Date().toISOString(),
        message: `Completed pass ${pass}/${totalPasses} using ${methodConfig.name}`,
        level: 'info'
      })
    }

    // Verification phase
    if (methodConfig.verification) {
      operation.logs.push({
        timestamp: new Date().toISOString(),
        message: 'Starting verification phase...',
        level: 'info'
      })
      
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      operation.logs.push({
        timestamp: new Date().toISOString(),
        message: 'Verification completed successfully',
        level: 'success'
      })
    }

    // Complete the operation
    operation.status = 'completed'
    operation.endTime = new Date().toISOString()
    operation.progress = 100
    
    // Generate certificate ID
    operation.certificateId = `CERT-${Date.now()}`
    
    // Add completion log
    operation.logs.push({
      timestamp: new Date().toISOString(),
      message: 'Wipe operation completed successfully',
      level: 'success'
    })

    // Move to history
    wipeHistory.push({ ...operation })
    activeWipes.delete(operationId)

  } catch (error) {
    operation.status = 'failed'
    operation.endTime = new Date().toISOString()
    operation.error = error instanceof Error ? error.message : 'Unknown error'
    
    operation.logs.push({
      timestamp: new Date().toISOString(),
      message: `Wipe operation failed: ${operation.error}`,
      level: 'error'
    })

    // Move to history
    wipeHistory.push({ ...operation })
    activeWipes.delete(operationId)
  }
}