import fs from 'fs';
import path from 'path';
import { vcService } from '../backend/utils/vc-service';

/**
 * Script to generate a new key pair for the VC issuer
 * This will delete any existing key and generate a new one
 */
async function generateNewKeys() {
  try {
    console.log('Starting key pair generation process...');
    
    // Define the path to the key file
    const keyFilePath = path.join(process.cwd(), 'data', 'keys', 'issuer_key.json');
    
    // Check if the key file exists
    if (fs.existsSync(keyFilePath)) {
      console.log('Existing key file found. Deleting...');
      fs.unlinkSync(keyFilePath);
      console.log('Existing key file deleted successfully.');
    } else {
      console.log('No existing key file found. Will generate a new one.');
    }
    
    // Clear any cached key data in memory
    console.log('Initializing VC service to generate new key pair...');
    
    // Initialize the VC service, which will generate a new key pair
    await vcService.initialize();
    
    // Get the DID document to display information about the new key
    const didDocument = vcService.getDidDocument();
    
    console.log('\nKey pair generated successfully!');
    console.log('-----------------------------------');
    console.log(`DID: ${didDocument.id}`);
    console.log(`Verification Method: ${didDocument.assertionMethod[0]}`);
    console.log(`Key file stored at: ${keyFilePath}`);
    console.log('-----------------------------------');
    console.log('The new key pair will be used for signing all Verifiable Credentials.');
    
  } catch (error) {
    console.error('Error generating key pair:', error);
    process.exit(1);
  }
}

// Run the function
generateNewKeys().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});