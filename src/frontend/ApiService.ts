const API_URL = 'http://localhost:3001/api';

export class ApiService {
    async verifyCredential(credential: string): Promise<VerificationResult> {
        const response = await fetch(`${API_URL}/verify`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
                presentation: credential.startsWith('ey') ? credential : JSON.parse(credential) 
            }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`Verification failed: ${errorData.error || 'Unknown error'}`);
        }

        return await response.json();
    }
}

interface VerificationResult {
    isValid: boolean;
    issuedByUs?: boolean;
    errors?: string[];
    subject?: Record<string, any>;
    isQualified?: boolean;
    certificateInfo?: CertificateInfo;
}

interface CertificateInfo {
    isValid: boolean;
    validFrom?: Date;
    validTo?: Date;
    chainValid?: boolean;
    isRevoked?: boolean;
    issuer?: string;
    subject?: string;
    signatureValid?: boolean;
}
