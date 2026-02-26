export interface CertificateData {
  id: string;
  certificateId: string;
  wipeId: string;
  timestamp: string;
  deviceInfo: {
    name: string;
    type: 'HDD' | 'SSD' | 'USB' | 'SD' | 'NVMe';
    size: string;
    sizeBytes: number;
    model: string;
    serial: string;
    firmware: string;
    path: string;
    vendor?: string;
  };
  wipeDetails: {
    method: string;
    methodName: string;
    passes: number;
    startTime: string;
    endTime: string;
    duration: string;
    status: 'completed' | 'failed' | 'partial';
    verification: {
      hashAlgorithm: string;
      dataHash: string;
      signature: string;
      publicKey: string;
    };
  };
  security: {
    level: 'low' | 'medium' | 'high' | 'maximum';
    standards: string[];
    compliance: string[];
  };
  operator: {
    id?: string;
    username?: string;
    ipAddress: string;
    userAgent: string;
  };
  verification: {
    certificateHash: string;
    digitalSignature: string;
    qrCodeData: string;
    verificationUrl: string;
  };
}

export interface CertificateVerification {
  isValid: boolean;
  certificateId: string;
  verifiedAt: string;
  verificationDetails: {
    signatureValid: boolean;
    hashValid: boolean;
    timestampValid: boolean;
    deviceInfoValid: boolean;
  };
  errors?: string[];
}

export interface CertificateCreateRequest {
  wipeId: string;
  deviceId: string;
  deviceInfo: any;
  wipeMethod: string;
  wipeDetails: {
    startTime: string;
    endTime: string;
    duration: string;
    status: string;
    passes: number;
  };
  operatorInfo: {
    ipAddress: string;
    userAgent: string;
    username?: string;
  };
}