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