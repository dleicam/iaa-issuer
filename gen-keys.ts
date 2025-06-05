import * as jose from 'jose';
import fs from 'fs';
import path from 'path';

async function generateAndExportKeys(): Promise<void> {
  console.log("Generating Ed25519 Key Pair for DID-based signing...");
  // Generate Ed25519 private key
  const { privateKey } = await jose.generateKeyPair('EdDSA', { crv: 'Ed25519' , extractable: true});
  // Export the private key in JWK format
  const privateJwk: jose.JWK = await jose.exportJWK(privateKey);

  console.log("Ed25519 Private JWK:", JSON.stringify(privateJwk, null, 2));

  // Define the path for saving the JWK
  // Adjust the path if your script is not in the root or if your test-data folder is elsewhere
  const testDataDir = path.join(__dirname, 'src', 'backend', 'tests', 'test-data');
  if (!fs.existsSync(testDataDir)){
      fs.mkdirSync(testDataDir, { recursive: true });
  }
  const jwkFilePath = path.join(testDataDir, 'test-issuer-ed25519-priv.jwk');

  try {
    fs.writeFileSync(jwkFilePath, JSON.stringify(privateJwk, null, 2));
    console.log(`Ed25519 JWK saved to ${jwkFilePath}`);
  } catch (error) {
    console.error(`Failed to write Ed25519 JWK to file: ${error}`);
  }


  console.log("\nGenerating RSA Key Pair and Certificate for RS256 signing (use OpenSSL for PEM generation)...");
  // Instruction for user to run openssl commands
  console.log("REMEMBER to run the openssl commands separately to generate PEM files for RS256 as described previously.");
  console.log("Example OpenSSL commands:");
  console.log("1. Generate RSA Private Key: openssl genpkey -algorithm RSA -out issuer_rsa_private.pem -pkeyopt rsa_keygen_bits:2048");
  console.log("2. Generate Self-Signed X.509 Certificate: openssl req -new -x509 -key issuer_rsa_private.pem -out issuer_rsa_cert.pem -days 365 -subj \"/CN=TestIssuer/O=TestOrg/C=US\"");
  console.log("Then, copy the contents of these PEM files into your .env file.");
}

// Execute the function
generateAndExportKeys().catch(error => {
  console.error("Error during key generation script:", error);
  process.exit(1); // Exit with error code if script fails
});