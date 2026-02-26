"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
import { 
  HardDrive, 
  Shield, 
  Zap, 
  AlertTriangle, 
  CheckCircle, 
  Clock,
  Thermometer,
  Database,
  Activity,
  RefreshCw,
  Trash2,
  Info,
  Certificate
} from "lucide-react"
import { CertificateDisplay } from "@/components/certificate-display"
import { CertificateData } from "@/types/certificate"

interface DeviceDetailsProps {
  deviceId: string
  onDeviceChange?: () => void
}

interface WipeMethod {
  id: string
  name: string
  description: string
  passes: number
  timeEstimate: string
  security: 'low' | 'medium' | 'high' | 'maximum'
  recommended: boolean
  features: string[]
}

interface DeviceInfo {
  id: string
  name: string
  type: 'HDD' | 'SSD' | 'USB' | 'SD' | 'NVMe'
  size: string
  sizeBytes: number
  model: string
  serial: string
  firmware: string
  status: 'available' | 'wiping' | 'completed' | 'error' | 'offline'
  sectors: number
  blockSize: number
  path: string
  vendor?: string
  temperature?: number
  health?: 'excellent' | 'good' | 'fair' | 'poor' | 'critical'
  isRemovable: boolean
  isSystem: boolean
  mountPoints?: string[]
}

export function DeviceDetails({ deviceId, onDeviceChange }: DeviceDetailsProps) {
  const [device, setDevice] = useState<DeviceInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedWipeMethod, setSelectedWipeMethod] = useState<string>("")
  const [wiping, setWiping] = useState(false)
  const [wipeProgress, setWipeProgress] = useState(0)
  const [verification, setVerification] = useState<any>(null)
  const [certificate, setCertificate] = useState<CertificateData | null>(null)
  const [generatingCertificate, setGeneratingCertificate] = useState(false)

  useEffect(() => {
    loadDeviceDetails()
  }, [deviceId])

  const loadDeviceDetails = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/devices')
      const data = await response.json()
      if (data.success) {
        const foundDevice = data.devices.find((d: any) => d.id === deviceId)
        if (foundDevice) {
          setDevice(foundDevice)
          
          // Get device verification info
          const verifyResponse = await fetch('/api/devices', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ deviceId, action: 'verify' })
          })
          const verifyData = await verifyResponse.json()
          if (verifyData.success) {
            setVerification(verifyData.verification)
          }
        }
      }
    } catch (error) {
      console.error('Failed to load device details:', error)
    } finally {
      setLoading(false)
    }
  }

  const getWipeMethods = (device: DeviceInfo): WipeMethod[] => {
    const sizeGB = device.sizeBytes / (1024 * 1024 * 1024)
    const baseTime = Math.ceil(sizeGB * 10) // Base time in minutes
    
    const methods: WipeMethod[] = [
      {
        id: 'quick',
        name: 'Quick Erase',
        description: 'Single pass overwrite with zeros',
        passes: 1,
        timeEstimate: `${baseTime} min`,
        security: 'low',
        recommended: device.type === 'USB' || device.type === 'SD',
        features: ['Fast', 'Basic security', 'Good for USB/SD cards']
      },
      {
        id: 'dod_5220',
        name: 'DoD 5220.22-M',
        description: '3-pass overwrite (zeros, ones, random)',
        passes: 3,
        timeEstimate: `${baseTime * 3} min`,
        security: 'medium',
        recommended: device.type === 'HDD',
        features: ['US Military Standard', 'Good balance', 'Widely accepted']
      },
      {
        id: 'gutmann',
        name: 'Gutmann Method',
        description: '35-pass overwrite with complex patterns',
        passes: 35,
        timeEstimate: `${baseTime * 35} min`,
        security: 'maximum',
        recommended: false,
        features: ['Maximum security', '35 different patterns', 'Overkill for most uses']
      },
      {
        id: 'secure_erase',
        name: 'ATA Secure Erase',
        description: 'Built-in drive secure erase command',
        passes: 1,
        timeEstimate: `${Math.ceil(baseTime * 0.5)} min`,
        security: 'high',
        recommended: device.type === 'SSD' || device.type === 'NVMe',
        features: ['Fastest for SSDs', 'Built-in hardware', 'Preserves drive life']
      },
      {
        id: 'random_passes',
        name: 'Random Multi-Pass',
        description: 'Multiple passes with random data',
        passes: 7,
        timeEstimate: `${baseTime * 7} min`,
        security: 'high',
        recommended: false,
        features: ['High security', 'Random patterns', 'Good for sensitive data']
      }
    ]

    // Set recommended method as default
    const recommendedMethod = methods.find(m => m.recommended)
    if (recommendedMethod && !selectedWipeMethod) {
      setSelectedWipeMethod(recommendedMethod.id)
    }

    return methods
  }

  const getSecurityColor = (security: string) => {
    switch (security) {
      case 'low': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'medium': return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'high': return 'bg-green-100 text-green-800 border-green-200'
      case 'maximum': return 'bg-purple-100 text-purple-800 border-purple-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getHealthColor = (health?: string) => {
    if (!health) return 'secondary'
    switch (health) {
      case 'excellent':
      case 'good': return 'default'
      case 'fair': return 'secondary'
      case 'poor':
      case 'critical': return 'destructive'
      default: return 'outline'
    }
  }

  const startWipe = async () => {
    if (!selectedWipeMethod || !device) return

    setWiping(true)
    setWipeProgress(0)
    setCertificate(null)

    try {
      // Generate wipe ID
      const wipeId = `wipe-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      
      // Simulate wipe progress
      const wipeMethod = getWipeMethods(device).find(m => m.id === selectedWipeMethod)
      const totalTime = wipeMethod?.passes || 1
      const startTime = new Date().toISOString()
      
      for (let i = 0; i <= totalTime; i++) {
        await new Promise(resolve => setTimeout(resolve, 1000)) // Simulate work
        setWipeProgress((i / totalTime) * 100)
      }

      const endTime = new Date().toISOString()
      const duration = `${Math.round((new Date(endTime).getTime() - new Date(startTime).getTime()) / 1000)} seconds`

      // Call wipe API
      const response = await fetch('/api/wipe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId,
          method: selectedWipeMethod,
          devicePath: device.path,
          wipeId
        })
      })

      const result = await response.json()
      
      if (result.success) {
        // Generate certificate
        await generateCertificate({
          wipeId,
          deviceId,
          deviceInfo: device,
          wipeMethod: selectedWipeMethod,
          wipeDetails: {
            startTime,
            endTime,
            duration,
            status: 'completed',
            passes: totalTime
          }
        })
        
        setTimeout(() => {
          setWiping(false)
          setWipeProgress(0)
          onDeviceChange?.()
        }, 2000)
      } else {
        throw new Error(result.error || 'Wipe failed')
      }
    } catch (error) {
      console.error('Wipe failed:', error)
      setWiping(false)
      setWipeProgress(0)
    }
  }

  const generateCertificate = async (wipeData: any) => {
    setGeneratingCertificate(true)
    try {
      const operatorInfo = {
        ipAddress: '127.0.0.1', // In production, get from request
        userAgent: navigator.userAgent,
        username: 'System User' // In production, get from auth
      }

      const response = await fetch('/api/certificates/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...wipeData,
          operatorInfo
        })
      })

      const result = await response.json()
      
      if (result.success) {
        setCertificate(result.certificate)
      } else {
        console.error('Certificate generation failed:', result.error)
      }
    } catch (error) {
      console.error('Certificate generation error:', error)
    } finally {
      setGeneratingCertificate(false)
    }
  }

  if (loading) {
    return (
      <Card className="h-[600px] flex items-center justify-center">
        <CardContent className="text-center">
          <RefreshCw className="h-8 w-8 mx-auto mb-4 animate-spin" />
          <p>Loading device details...</p>
        </CardContent>
      </Card>
    )
  }

  if (!device) {
    return (
      <Card className="h-[600px] flex items-center justify-center">
        <CardContent className="text-center">
          <AlertTriangle className="h-16 w-16 mx-auto mb-4 text-destructive" />
          <h3 className="text-lg font-semibold mb-2">Device Not Found</h3>
          <p className="text-muted-foreground">
            The selected device could not be found
          </p>
        </CardContent>
      </Card>
    )
  }

  const wipeMethods = getWipeMethods(device)
  const selectedMethod = wipeMethods.find(m => m.id === selectedWipeMethod)

  return (
    <div className="space-y-6">
      {/* Device Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {device.type === 'SSD' || device.type === 'NVMe' ? (
              <Zap className="h-5 w-5" />
            ) : (
              <HardDrive className="h-5 w-5" />
            )}
            Device Information
          </CardTitle>
          <CardDescription>
            Detailed information about the selected storage device
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Device Name</p>
              <p className="font-medium">{device.name}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Type</p>
              <Badge variant="outline">{device.type}</Badge>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Size</p>
              <p className="font-medium">{device.size}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Status</p>
              <Badge variant={getHealthColor(device.health)}>{device.status}</Badge>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
            <div className="space-y-3">
              <div>
                <p className="text-sm text-muted-foreground">Model</p>
                <p className="font-mono text-sm">{device.model}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Serial Number</p>
                <p className="font-mono text-sm">{device.serial}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Firmware</p>
                <p className="font-mono text-sm">{device.firmware}</p>
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-muted-foreground">Device Path</p>
                <p className="font-mono text-sm">{device.path}</p>
              </div>
              {device.vendor && (
                <div>
                  <p className="text-sm text-muted-foreground">Vendor</p>
                  <p className="font-mono text-sm">{device.vendor}</p>
                </div>
              )}
              {device.temperature && (
                <div className="flex items-center gap-2">
                  <Thermometer className="h-4 w-4" />
                  <p className="text-sm text-muted-foreground">Temperature</p>
                  <p className="font-medium">{device.temperature}°C</p>
                </div>
              )}
              {device.health && (
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4" />
                  <p className="text-sm text-muted-foreground">Health</p>
                  <Badge variant={getHealthColor(device.health)}>{device.health}</Badge>
                </div>
              )}
            </div>
          </div>

          {/* Device Verification */}
          {verification && (
            <div className="pt-4 border-t">
              <h4 className="font-medium mb-3 flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Device Verification
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle className={`h-4 w-4 ${verification.accessible ? 'text-green-600' : 'text-red-600'}`} />
                    <span className="text-sm">Device Accessible</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className={`h-4 w-4 ${verification.writable ? 'text-green-600' : 'text-red-600'}`} />
                    <span className="text-sm">Device Writable</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle className={`h-4 w-4 ${verification.supportsSecureErase ? 'text-green-600' : 'text-gray-400'}`} />
                    <span className="text-sm">Secure Erase Supported</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-blue-600" />
                    <span className="text-sm">Est. Time: {verification.estimatedTime}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Wipe Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trash2 className="h-5 w-5" />
            Secure Wipe Configuration
          </CardTitle>
          <CardDescription>
            Select a wipe method and start the secure data erasure process
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Wipe Method Selection */}
          <div className="space-y-3">
            <label className="text-sm font-medium">Wipe Method</label>
            <Select value={selectedWipeMethod} onValueChange={setSelectedWipeMethod} disabled={wiping}>
              <SelectTrigger>
                <SelectValue placeholder="Select a wipe method" />
              </SelectTrigger>
              <SelectContent>
                {wipeMethods.map((method) => (
                  <SelectItem key={method.id} value={method.id}>
                    <div className="flex items-center gap-2">
                      <span>{method.name}</span>
                      {method.recommended && (
                        <Badge variant="default" className="text-xs">Recommended</Badge>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Selected Method Details */}
          {selectedMethod && (
            <div className="border rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-medium">{selectedMethod.name}</h4>
                <Badge className={getSecurityColor(selectedMethod.security)}>
                  {selectedMethod.security} security
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">{selectedMethod.description}</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Passes</p>
                  <p className="font-medium">{selectedMethod.passes}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Est. Time</p>
                  <p className="font-medium">{selectedMethod.timeEstimate}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-muted-foreground">Features</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {selectedMethod.features.map((feature, index) => (
                      <Badge key={index} variant="outline" className="text-xs">
                        {feature}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Warning */}
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Warning:</strong> This action will permanently erase all data on the selected device. 
              This process cannot be undone. Make sure you have backups of any important data before proceeding.
            </AlertDescription>
          </Alert>

          {/* Progress */}
          {wiping && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Wiping in progress...</span>
                <span>{Math.round(wipeProgress)}%</span>
              </div>
              <Progress value={wipeProgress} className="h-2" />
              <p className="text-xs text-muted-foreground">
                Do not disconnect or power off the device during this process
              </p>
            </div>
          )}

          {/* Action Button */}
          <Button 
            onClick={startWipe}
            disabled={!selectedWipeMethod || wiping || device.status !== 'available'}
            className="w-full"
            size="lg"
          >
            {wiping ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Wiping Device...
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4 mr-2" />
                Start Secure Wipe
              </>
            )}
          </Button>
          {/* Certificate Display */}
          {certificate && (
            <div className="mt-6">
              <div className="flex items-center gap-2 mb-4">
                <Certificate className="h-5 w-5 text-green-600" />
                <h3 className="text-lg font-semibold">Tamper-Proof Certificate</h3>
                <Badge variant="outline" className="text-green-600 border-green-600">
                  Generated
                </Badge>
              </div>
              <CertificateDisplay certificate={certificate} />
            </div>
          )}

          {/* Certificate Generation Progress */}
          {generatingCertificate && (
            <div className="mt-6 p-4 border border-blue-200 bg-blue-50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <RefreshCw className="h-4 w-4 animate-spin text-blue-600" />
                <span className="text-sm font-medium text-blue-800">Generating Certificate...</span>
              </div>
              <p className="text-xs text-blue-600">
                Creating tamper-proof certificate with cryptographic verification
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}