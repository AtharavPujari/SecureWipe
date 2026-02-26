"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Activity, RefreshCw, HardDrive, Shield, Zap, AlertTriangle, CheckCircle } from "lucide-react"
import { DeviceDetails } from "@/components/device-details"

export default function SecureWipe() {
  const [selectedDevice, setSelectedDevice] = useState<string>("")
  const [refreshing, setRefreshing] = useState(false)
  const [devices, setDevices] = useState<any[]>([])

  const refreshData = async () => {
    setRefreshing(true)
    try {
      const response = await fetch('/api/devices')
      const data = await response.json()
      if (data.success) {
        setDevices(data.devices)
      }
    } catch (error) {
      console.error('Failed to refresh devices:', error)
    } finally {
      setTimeout(() => setRefreshing(false), 1000)
    }
  }

  useEffect(() => {
    refreshData()
  }, [])

  const getDeviceIcon = (type: string) => {
    switch (type) {
      case 'SSD':
      case 'NVMe':
        return <Zap className="h-4 w-4" />
      case 'HDD':
        return <HardDrive className="h-4 w-4" />
      default:
        return <HardDrive className="h-4 w-4" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available': return 'default'
      case 'offline': return 'secondary'
      case 'error': return 'destructive'
      default: return 'outline'
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

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <Shield className="h-8 w-8 text-primary" />
              <h1 className="text-2xl md:text-3xl font-bold">SecureWipe</h1>
            </div>
            <p className="text-muted-foreground">
              Detect, analyze, and securely wipe storage devices
            </p>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={refreshData}
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Device List */}
          <div className="lg:col-span-1">
            <Card className="h-[600px] flex flex-col">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Storage Devices
                  <Badge variant="outline">{devices.length}</Badge>
                </CardTitle>
                <CardDescription>
                  Select a device to view details and wipe options
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-1 p-0">
                <ScrollArea className="h-[480px] px-6 pb-6">
                  <div className="space-y-3">
                    {devices.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <HardDrive className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>No storage devices detected</p>
                        <p className="text-sm">Click refresh to scan again</p>
                      </div>
                    ) : (
                      devices.map((device) => (
                        <div
                          key={device.id}
                          className={`p-4 border rounded-lg cursor-pointer transition-colors hover:bg-muted/50 ${
                            selectedDevice === device.id ? 'border-primary bg-primary/5' : 'border-border'
                          }`}
                          onClick={() => setSelectedDevice(device.id)}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex items-start gap-3 flex-1">
                              {getDeviceIcon(device.type)}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <h4 className="font-medium truncate">{device.name}</h4>
                                  <Badge variant={getStatusColor(device.status)} className="text-xs">
                                    {device.status}
                                  </Badge>
                                </div>
                                <p className="text-sm text-muted-foreground mb-2">
                                  {device.size} • {device.type}
                                </p>
                                <div className="flex items-center gap-2 text-xs">
                                  <span className="text-muted-foreground">Model:</span>
                                  <span className="font-mono text-xs truncate">{device.model}</span>
                                </div>
                                {device.health && (
                                  <div className="flex items-center gap-2 mt-1">
                                    <Badge variant={getHealthColor(device.health)} className="text-xs">
                                      Health: {device.health}
                                    </Badge>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          {/* Device Details */}
          <div className="lg:col-span-2">
            {selectedDevice ? (
              <DeviceDetails 
                deviceId={selectedDevice} 
                onDeviceChange={refreshData}
              />
            ) : (
              <Card className="h-[600px] flex items-center justify-center">
                <CardContent className="text-center">
                  <HardDrive className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-semibold mb-2">Select a Storage Device</h3>
                  <p className="text-muted-foreground">
                    Choose a device from the list to view its details and wipe options
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}