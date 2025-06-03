import * as jose from 'jose'; // Use jose for robust JWT signing

export function parseJwt(jwt: string): { header: any; payload: any; signature: string } | null {
  try {
    const parts = jwt.split('.');
    if (parts.length !== 3) {
      console.error(`Invalid JWT format: expected 3 parts, got ${parts.length}`);
      return null;
    }

    const [headerB64, payloadB64, signatureB64] = parts;
    
    if (!headerB64 || !payloadB64 || !signatureB64) {
      console.error('JWT missing required parts');
      return null;
    }

    const header = JSON.parse(b64urlToUtf8(headerB64));
    const payload = JSON.parse(b64urlToUtf8(payloadB64));

    return {
      header,
      payload,
      signature: signatureB64
    };
  } catch (error) {
    console.error('Error parsing JWT:', error);
    return null;
  }
}

export function isJwt(str: string): boolean {
  return str.startsWith('eyJ') && str.split('.').length === 3;
}

export function isVpJwt(jwt: { header: any; payload: any }): boolean {
  return !!jwt.payload.vp;
}

export function isVcJwt(jwt: { header: any; payload: any }): boolean {
  return !!jwt.payload.vc;
}

export function b64urlToUtf8(str: string): string {
  // Existing function
  return Buffer.from(str, 'base64url').toString();
}

export function getJwtRawParts(jwt: string): { headerB64: string; payloadB64: string } | null {
  try {
    const parts = jwt.split('.');
    if (parts.length !== 3) {
      return null;
    }

    const [headerB64, payloadB64] = parts;
    return { headerB64, payloadB64 };
  } catch (error) {
    console.error('Error getting JWT raw parts:', error);
    return null;
  }
}

// --- NEW HELPER FUNCTIONS FOR JWT SIGNING ---

/**
 * Signs a JWT payload using RS256 algorithm with an X.509 certificate chain.
 * @param payload The payload object to be signed.
 * @param privateKeyPem The RSA private key in PEM format.
 * @param certificatePem The X.509 certificate in PEM format.
 * @returns The signed JWT string.
 */
export async function signJwtWithRs256AndX5c(
  payload: object,
  privateKeyPem: string,
  certificatePem: string
): Promise<string> {
  const certificateBase64 = certificatePem
    .replace('-----BEGIN CERTIFICATE-----', '')
    .replace('-----END CERTIFICATE-----', '')
    .replace(/\s/g, ''); // Remove all whitespace

  const header = {
    alg: 'RS256',
    typ: 'JWT', // Standard JWT type
    x5c: [certificateBase64], // X.509 certificate chain (often just one cert for self-signed)
  };

  const privateKey = await jose.importPKCS8(privateKeyPem, 'RS256');

  const signedJwt = await new jose.SignJWT(payload)
    .setProtectedHeader(header)
    .setIssuedAt()
    // Use the actual 'id' of the credential from the payload as JTI if present
    .setJti((payload as any).id || undefined)
    .setIssuer((payload as any).issuer) // Set issuer from payload
    .setSubject((payload as any).credentialSubject?.id || (payload as any).sub) // Set subject from payload
    .setExpirationTime((payload as any).expirationDate ? new Date((payload as any).expirationDate) : '1h') // **FIXED:** Ensure Date object or duration string for jose
    .sign(privateKey);

  return signedJwt;
}

/**
 * Signs a JWT payload using a DID-based key (e.g., Ed25519 for did:key).
 * Assumes the payload contains 'issuer' and 'credentialSubject.id'.
 * @param payload The payload object to be signed.
 * @param privateKeyJwk The private key in JWK format (e.g., Ed25519).
 * @param issuerDid The DID of the issuer (e.g., did:key:...).
 * @returns The signed JWT string.
 */
export async function signJwtWithDidKey(
  payload: object,
  privateKeyJwk: jose.JWK,
  issuerDid: string,
): Promise<string> {
    const privateKey = await jose.importJWK(privateKeyJwk, 'EdDSA');

    // NEW: Minimal KID derivation for better interoperability, common for DID-based JWTs
    // If privateKeyJwk already has a kid, use it. Otherwise, construct a simple one.
    const kid = privateKeyJwk.kid || `${issuerDid}#key-1`; 

    const header: jose.ProtectedHeaderParameters = {
        alg: 'EdDSA', // Algorithm for Ed25519
        typ: 'JWT',
        kid: kid, // Include the key ID
    };

    const signedJwt = await new jose.SignJWT(payload)
        .setProtectedHeader(header)
        .setIssuedAt()
        .setJti((payload as any).id || undefined)
        .setIssuer(issuerDid) // Explicitly set issuer as the DID
        .setSubject((payload as any).credentialSubject?.id || (payload as any).sub)
        .setExpirationTime((payload as any).expirationDate ? new Date((payload as any).expirationDate) : '1h') // **FIXED:** Ensure Date object or duration string for jose
        .sign(privateKey);

    return signedJwt;
}
