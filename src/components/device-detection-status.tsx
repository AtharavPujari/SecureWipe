"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { 
  Activity, 
  CheckCircle, 
  AlertTriangle, 
  Info, 
  RefreshCw, 
  Server,
  Database,
  Shield,
  HelpCircle
} from "lucide-react"

interface DetectionStatus {
  isScanning: boolean
  lastScan: Date | null
  deviceCount: number
  detectionMethod: 'real' | 'fallback' | 'error'
  platform: string
  environment: 'container' | 'physical' | 'virtual'
  message: string
  details: string[]
}

interface DeviceDetectionStatusProps {
  onRefresh?: () => void
  className?: string
}

export function DeviceDetectionStatus({ onRefresh, className }: DeviceDetectionStatusProps) {
  const [status, setStatus] = useState<DetectionStatus>({
    isScanning: false,
    lastScan: null,
    deviceCount: 0,
    detectionMethod: 'fallback',
    platform: 'Unknown',
    environment: 'container',
    message: 'Initializing device detection...',
    details: []
  })

  useEffect(() => {
    checkDetectionStatus()
  }, [])

  const checkDetectionStatus = async () => {
    setStatus(prev => ({ ...prev, isScanning: true, message: 'Detecting storage devices...' }))
    
    try {
      // Get comprehensive system information
      const [deviceResponse, systemResponse] = await Promise.all([
        fetch('/api/devices'),
        fetch('/api/system-info')
      ])
      
      const deviceData = await deviceResponse.json()
      const systemData = await systemResponse.json()
      
      if (deviceData.success && systemData.success) {
        const deviceCount = deviceData.devices?.length || 0
        const systemInfo = systemData.systemInfo
        
        setStatus({
          isScanning: false,
          lastScan: new Date(),
          deviceCount,
          detectionMethod: systemInfo.deviceDetectionMethod,
          platform: systemInfo.platform,
          environment: systemInfo.environment,
          message: getDetectionMessage(deviceCount, systemInfo.environment, systemInfo.deviceDetectionMethod),
          details: getDetectionDetails(deviceCount, systemInfo, deviceData.devices)
        })
      } else {
        throw new Error(deviceData.error || systemData.error || 'Failed to detect devices')
      }
    } catch (error) {
      setStatus({
        isScanning: false,
        lastScan: new Date(),
        deviceCount: 0,
        detectionMethod: 'error',
        platform: 'Unknown',
        environment: 'container',
        message: 'Unable to detect storage devices',
        details: [
          'Device detection encountered an error',
          'This may be due to permission restrictions or environment limitations',
          'Please ensure the application has necessary permissions'
        ]
      })
    }
  }

  const getDetectionMessage = (count: number, env: string, method: string): string => {
    if (count === 0) {
      return 'No storage devices detected'
    }
    
    if (env === 'container') {
      return `Detected ${count} virtual storage device${count > 1 ? 's' : ''} in container environment`
    }
    
    if (method === 'real') {
      return `Detected ${count} physical storage device${count > 1 ? 's' : ''}`
    }
    
    return `Detected ${count} storage device${count > 1 ? 's' : ''}`
  }

  const getDetectionDetails = (count: number, systemInfo: any, devices?: any[]): string[] => {
    const details: string[] = []
    
    if (systemInfo.environment === 'container') {
      details.push('📦 Running in containerized environment')
      details.push(`🐳 Container type: ${systemInfo.containerType || 'unknown'}`)
      details.push('🔍 Showing virtual/emulated storage devices')
      details.push('💡 In a physical environment, real storage devices would be shown')
    } else if (systemInfo.deviceDetectionMethod === 'real') {
      details.push('🖥️  Running on physical hardware')
      details.push('🔍 Showing actual storage devices')
      details.push(`📡 Platform: ${systemInfo.platform} (${systemInfo.architecture})`)
    } else {
      details.push('⚠️  Using fallback detection method')
    }
    
    // Add permission information
    const perms = systemInfo.userPermissions
    details.push(`🔐 Device access: ${perms.canAccessDevices ? '✅ Available' : '❌ Restricted'}`)
    details.push(`⚡ Command execution: ${perms.canExecuteSystemCommands ? '✅ Available' : '❌ Restricted'}`)
    details.push(`👑 Sudo access: ${perms.hasSudoAccess ? '✅ Available' : '❌ Not available'}`)
    
    if (devices && devices.length > 0) {
      details.push(`📊 Device types: ${[...new Set(devices.map((d: any) => d.type))].join(', ')}`)
    }
    
    // Add recommendations from system info
    if (systemInfo.recommendations && systemInfo.recommendations.length > 0) {
      details.push('💡 Recommendations:')
      systemInfo.recommendations.forEach((rec: string, index: number) => {
        details.push(`   ${rec}`)
      })
    }
    
    return details
  }

  const getStatusColor = () => {
    if (status.isScanning) return 'text-blue-600'
    if (status.detectionMethod === 'error') return 'text-red-600'
    if (status.deviceCount === 0) return 'text-yellow-600'
    return 'text-green-600'
  }

  const getStatusIcon = () => {
    if (status.isScanning) return <RefreshCw className="h-5 w-5 animate-spin" />
    if (status.detectionMethod === 'error') return <AlertTriangle className="h-5 w-5" />
    if (status.deviceCount === 0) return <Info className="h-5 w-5" />
    return <CheckCircle className="h-5 w-5" />
  }

  const getEnvironmentBadge = () => {
    switch (status.environment) {
      case 'container':
        return <Badge variant="secondary"><Database className="h-3 w-3 mr-1" />Container</Badge>
      case 'physical':
        return <Badge variant="default"><Server className="h-3 w-3 mr-1" />Physical</Badge>
      case 'virtual':
        return <Badge variant="outline"><Activity className="h-3 w-3 mr-1" />Virtual</Badge>
      default:
        return <Badge variant="outline">Unknown</Badge>
    }
  }

  const getMethodBadge = () => {
    switch (status.detectionMethod) {
      case 'real':
        return <Badge variant="default"><Shield className="h-3 w-3 mr-1" />Real</Badge>
      case 'fallback':
        return <Badge variant="secondary">Fallback</Badge>
      case 'error':
        return <Badge variant="destructive">Error</Badge>
      default:
        return <Badge variant="outline">Unknown</Badge>
    }
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Main Status Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Device Detection Status
            <Button
              variant="outline"
              size="sm"
              onClick={onRefresh || checkDetectionStatus}
              disabled={status.isScanning}
              className="ml-auto"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${status.isScanning ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </CardTitle>
          <CardDescription>
            Real-time status of storage device detection and monitoring
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Status Summary */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {getStatusIcon()}
              <div>
                <p className={`font-medium ${getStatusColor()}`}>
                  {status.message}
                </p>
                <p className="text-sm text-muted-foreground">
                  {status.lastScan && `Last scan: ${status.lastScan.toLocaleTimeString()}`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {getEnvironmentBadge()}
              {getMethodBadge()}
            </div>
          </div>

          {/* Device Count */}
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="p-3 bg-muted rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{status.deviceCount}</div>
              <div className="text-sm text-muted-foreground">Devices Found</div>
            </div>
            <div className="p-3 bg-muted rounded-lg">
              <div className="text-2xl font-bold text-green-600">
                {status.detectionMethod === 'real' ? '✓' : status.detectionMethod === 'fallback' ? '⚠' : '✗'}
              </div>
              <div className="text-sm text-muted-foreground">Detection</div>
            </div>
            <div className="p-3 bg-muted rounded-lg">
              <div className="text-2xl font-bold text-purple-600">
                {status.environment === 'container' ? '📦' : status.environment === 'physical' ? '🖥️' : '🔧'}
              </div>
              <div className="text-sm text-muted-foreground">Environment</div>
            </div>
          </div>

          {/* Progress Bar for scanning */}
          {status.isScanning && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Scanning for devices...</span>
                <span>Please wait</span>
              </div>
              <Progress value={75} className="h-2" />
            </div>
          )}

          {/* Detailed Information */}
          <div className="space-y-2">
            <h4 className="font-medium flex items-center gap-2">
              <Info className="h-4 w-4" />
              Detection Details
            </h4>
            <div className="space-y-1">
              {status.details.map((detail, index) => (
                <div key={index} className="text-sm text-muted-foreground flex items-start gap-2">
                  <span className="mt-0.5">•</span>
                  <span>{detail}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Environment-specific information */}
          {status.environment === 'container' && (
            <Alert>
              <HelpCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Container Environment Detected:</strong> You're running in a containerized environment. 
                The storage devices shown are virtual/emulated. In a physical environment, 
                you would see actual storage devices like HDDs, SSDs, and USB drives.
              </AlertDescription>
            </Alert>
          )}

          {status.detectionMethod === 'error' && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>Detection Error:</strong> Unable to properly detect storage devices. 
                This could be due to permission restrictions or system limitations. 
                Please ensure the application has the necessary permissions to access storage devices.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  )
}