import { CertificateData } from '@/types/certificate'

// Shared in-memory storage for certificates
// In production, this would be replaced with a database
class CertificateStorage {
  private certificates = new Map<string, CertificateData>()
  private keyPairs = new Map<string, { publicKey: string; privateKey: string }>()

  // Certificate operations
  storeCertificate(certificateId: string, certificate: CertificateData): void {
    this.certificates.set(certificateId, certificate)
  }

  getCertificate(certificateId: string): CertificateData | undefined {
    return this.certificates.get(certificateId)
  }

  getAllCertificates(): CertificateData[] {
    return Array.from(this.certificates.values())
  }

  deleteCertificate(certificateId: string): boolean {
    return this.certificates.delete(certificateId)
  }

  // Key pair operations
  storeKeyPair(sessionId: string, keyPair: { publicKey: string; privateKey: string }): void {
    this.keyPairs.set(sessionId, keyPair)
  }

  getKeyPair(sessionId: string): { publicKey: string; privateKey: string } | undefined {
    return this.keyPairs.get(sessionId)
  }

  deleteKeyPair(sessionId: string): boolean {
    return this.keyPairs.delete(sessionId)
  }

  // Utility methods
  hasCertificate(certificateId: string): boolean {
    return this.certificates.has(certificateId)
  }

  getCertificateCount(): number {
    return this.certificates.size
  }

  clearAll(): void {
    this.certificates.clear()
    this.keyPairs.clear()
  }

  // Export/Import for debugging
  exportData(): { certificates: CertificateData[], keyPairs: [string, { publicKey: string, privateKey: string }][] } {
    return {
      certificates: this.getAllCertificates(),
      keyPairs: Array.from(this.keyPairs.entries())
    }
  }

  importData(data: { certificates?: CertificateData[], keyPairs?: [string, { publicKey: string, privateKey: string }][] }): void {
    if (data.certificates) {
      data.certificates.forEach(cert => {
        this.certificates.set(cert.certificateId, cert)
      })
    }
    if (data.keyPairs) {
      data.keyPairs.forEach(([sessionId, keyPair]) => {
        this.keyPairs.set(sessionId, keyPair)
      })
    }
  }
}

// Export singleton instance
export const certificateStorage = new CertificateStorage()

// Export for use in API routes
export { CertificateStorage }