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

        const apiResponse = await response.json();

        // Map the backend response to the expected format
        const result: VerificationResult = {
            isValid: apiResponse.verified === true && apiResponse.success === true,
            errors: apiResponse.success === false ? [apiResponse.message || 'Verification failed'] : undefined,
        };

        // Extract subject information from the verificationResult if available
        if (apiResponse.verificationResult && apiResponse.verificationResult.credentialResults) {
            // Extract credential subject from the first credential result
            const credentialResult = apiResponse.verificationResult.credentialResults[0];
            if (credentialResult && credentialResult.verified) {
                // The original credential might be in the presentation
                if (apiResponse.verificationResult.presentationResult && 
                    apiResponse.verificationResult.presentationResult.verified) {
                    result.subject = this.extractSubjectFromVerificationResult(apiResponse.verificationResult);
                }
            }
        }

        // Store the raw verification result for detailed display
        result.rawVerificationResult = apiResponse.verificationResult;

        return result;
    }

    private extractSubjectFromVerificationResult(verificationResult: any): Record<string, any> | undefined {
        // This is a simplified extraction - in a real implementation, you would
        // need to navigate the structure based on the actual data format
        try {
            // Try to extract from credential results
            if (verificationResult.credentialResults && 
                verificationResult.credentialResults.length > 0) {
                // You would need to access the actual credential data here
                // This is just a placeholder
                return { 
                    // Add basic extracted information
                    verified: verificationResult.verified === true,
                    // Add more fields as needed
                };
            }

            // If we can't extract specific subject data, return the verification result itself
            return {
                verified: verificationResult.verified === true,
                // Add more fields as needed
            };
        } catch (error) {
            console.error('Error extracting subject from verification result:', error);
            return undefined;
        }
    }
}

interface VerificationResult {
    isValid: boolean;
    issuedByUs?: boolean;
    errors?: string[];
    subject?: Record<string, any>;
    isQualified?: boolean;
    certificateInfo?: CertificateInfo;
    rawVerificationResult?: any; // Store the raw verification result for detailed display
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
