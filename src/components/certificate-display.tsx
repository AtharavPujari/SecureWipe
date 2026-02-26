"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import { 
  Shield, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Download, 
  Printer,
  Share,
  QrCode,
  Certificate,
  Hash,
  Fingerprint,
  Server,
  User,
  Calendar,
  HardDrive,
  AlertTriangle
} from "lucide-react"
import { CertificateData, CertificateVerification } from "@/types/certificate"

interface CertificateDisplayProps {
  certificate: CertificateData
  onVerificationComplete?: (verification: CertificateVerification) => void
}

export function CertificateDisplay({ certificate, onVerificationComplete }: CertificateDisplayProps) {
  const [verification, setVerification] = useState<CertificateVerification | null>(null)
  const [verifying, setVerifying] = useState(false)
  const [qrCodeData, setQrCodeData] = useState<string>("")

  useEffect(() => {
    generateQRCode()
  }, [certificate])

  const generateQRCode = async () => {
    try {
      const QRCode = (await import('qrcode')).default
      const qr = await QRCode.toDataURL(certificate.verification.qrCodeData, {
        width: 200,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#ffffff'
        }
      })
      setQrCodeData(qr)
    } catch (error) {
      console.error('Failed to generate QR code:', error)
    }
  }

  const verifyCertificate = async () => {
    setVerifying(true)
    try {
      const response = await fetch(`/api/certificates/verify/${certificate.certificateId}`)
      const data = await response.json()
      
      if (data.success) {
        setVerification(data.verification)
        onVerificationComplete?.(data.verification)
      }
    } catch (error) {
      console.error('Verification failed:', error)
    } finally {
      setVerifying(false)
    }
  }

  const downloadCertificate = async () => {
    try {
      const response = await fetch(`/api/certificates?id=${certificate.certificateId}&format=pdf`)
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `certificate-${certificate.certificateId}.pdf`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      console.error('Download failed:', error)
    }
  }

  const printCertificate = () => {
    window.print()
  }

  const shareCertificate = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: 'SecureWipe Certificate',
          text: `Certificate for ${certificate.deviceInfo.name} - ${certificate.certificateId}`,
          url: certificate.verification.verificationUrl
        })
      } else {
        // Fallback: copy to clipboard
        await navigator.clipboard.writeText(certificate.verification.verificationUrl)
        alert('Verification URL copied to clipboard!')
      }
    } catch (error) {
      console.error('Share failed:', error)
    }
  }

  const getSecurityColor = (level: string) => {
    switch (level) {
      case 'low': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'medium': return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'high': return 'bg-green-100 text-green-800 border-green-200'
      case 'maximum': return 'bg-purple-100 text-purple-800 border-purple-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="h-4 w-4 text-green-600" />
      case 'failed': return <XCircle className="h-4 w-4 text-red-600" />
      case 'partial': return <AlertTriangle className="h-4 w-4 text-yellow-600" />
      default: return <Clock className="h-4 w-4 text-gray-600" />
    }
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Certificate Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <CardTitle className="flex items-center gap-2">
                <Certificate className="h-6 w-6" />
                SecureWipe Certificate
              </CardTitle>
              <CardDescription>
                Tamper-proof certificate of data sanitization
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={verifyCertificate} disabled={verifying}>
                {verifying ? <Clock className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" />}
                Verify
              </Button>
              <Button variant="outline" size="sm" onClick={downloadCertificate}>
                <Download className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={printCertificate}>
                <Printer className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={shareCertificate}>
                <Share className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Verification Status */}
      {verification && (
        <Alert className={verification.isValid ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}>
          <div className="flex items-center gap-2">
            {verification.isValid ? (
              <CheckCircle className="h-4 w-4 text-green-600" />
            ) : (
              <XCircle className="h-4 w-4 text-red-600" />
            )}
            <AlertDescription>
              <div className="space-y-1">
                <p className="font-medium">
                  Certificate {verification.isValid ? "Verified" : "Verification Failed"}
                </p>
                {verification.errors && (
                  <div className="text-sm space-y-1">
                    {verification.errors.map((error, index) => (
                      <p key={index} className="text-red-600">• {error}</p>
                    ))}
                  </div>
                )}
              </div>
            </AlertDescription>
          </div>
        </Alert>
      )}

      {/* Certificate Details */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Certificate Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Device Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <HardDrive className="h-5 w-5" />
                Device Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Device Name</p>
                  <p className="font-medium">{certificate.deviceInfo.name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Type</p>
                  <Badge variant="outline">{certificate.deviceInfo.type}</Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Size</p>
                  <p className="font-medium">{certificate.deviceInfo.size}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Serial Number</p>
                  <p className="font-mono text-sm">{certificate.deviceInfo.serial}</p>
                </div>
              </div>
              <Separator />
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Model</p>
                  <p className="font-mono text-sm">{certificate.deviceInfo.model}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Firmware</p>
                  <p className="font-mono text-sm">{certificate.deviceInfo.firmware}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Device Path</p>
                  <p className="font-mono text-sm">{certificate.deviceInfo.path}</p>
                </div>
                {certificate.deviceInfo.vendor && (
                  <div>
                    <p className="text-sm text-muted-foreground">Vendor</p>
                    <p className="font-mono text-sm">{certificate.deviceInfo.vendor}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Wipe Details */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Wipe Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Method</p>
                  <p className="font-medium">{certificate.wipeDetails.methodName}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <div className="flex items-center gap-2">
                    {getStatusIcon(certificate.wipeDetails.status)}
                    <span className="capitalize">{certificate.wipeDetails.status}</span>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Passes</p>
                  <p className="font-medium">{certificate.wipeDetails.passes}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Duration</p>
                  <p className="font-medium">{certificate.wipeDetails.duration}</p>
                </div>
              </div>
              <Separator />
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Start Time</p>
                  <p className="font-medium">{new Date(certificate.wipeDetails.startTime).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">End Time</p>
                  <p className="font-medium">{new Date(certificate.wipeDetails.endTime).toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Security Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Fingerprint className="h-5 w-5" />
                Security Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <p className="text-sm text-muted-foreground">Security Level</p>
                <Badge className={getSecurityColor(certificate.security.level)}>
                  {certificate.security.level.toUpperCase()}
                </Badge>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-2">Compliance Standards</p>
                <div className="flex flex-wrap gap-2">
                  {certificate.security.compliance.map((standard, index) => (
                    <Badge key={index} variant="outline" className="text-xs">
                      {standard}
                    </Badge>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-2">Security Standards</p>
                <div className="flex flex-wrap gap-2">
                  {certificate.security.standards.map((standard, index) => (
                    <Badge key={index} variant="secondary" className="text-xs">
                      {standard}
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* QR Code */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <QrCode className="h-5 w-5" />
                Verification QR Code
              </CardTitle>
              <CardDescription>
                Scan to verify certificate authenticity
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              {qrCodeData ? (
                <div className="space-y-3">
                  <img src={qrCodeData} alt="QR Code" className="mx-auto border rounded" />
                  <p className="text-xs text-muted-foreground">
                    Certificate ID: {certificate.certificateId}
                  </p>
                </div>
              ) : (
                <div className="h-48 bg-muted rounded flex items-center justify-center">
                  <QrCode className="h-8 w-8 text-muted-foreground" />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Certificate Metadata */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Hash className="h-5 w-5" />
                Certificate Metadata
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm text-muted-foreground">Certificate ID</p>
                <p className="font-mono text-xs break-all">{certificate.certificateId}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Wipe ID</p>
                <p className="font-mono text-xs break-all">{certificate.wipeId}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Generated</p>
                <p className="text-sm">{new Date(certificate.timestamp).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Verification URL</p>
                <p className="font-mono text-xs break-all">{certificate.verification.verificationUrl}</p>
              </div>
            </CardContent>
          </Card>

          {/* Operator Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Operator Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm text-muted-foreground">Username</p>
                <p className="text-sm">{certificate.operator.username || 'System'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">IP Address</p>
                <p className="font-mono text-sm">{certificate.operator.ipAddress}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">User Agent</p>
                <p className="text-xs text-muted-foreground break-all">
                  {certificate.operator.userAgent.substring(0, 50)}...
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Cryptographic Evidence */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Fingerprint className="h-5 w-5" />
                Cryptographic Evidence
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm text-muted-foreground">Certificate Hash</p>
                <p className="font-mono text-xs break-all">{certificate.verification.certificateHash}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Digital Signature</p>
                <p className="font-mono text-xs break-all">{certificate.verification.digitalSignature.substring(0, 50)}...</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Hash Algorithm</p>
                <p className="text-sm">{certificate.wipeDetails.verification.hashAlgorithm}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}