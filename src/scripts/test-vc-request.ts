import axios from 'axios';

// Sample VP from the issue description
const sampleVP = {
    "@context": [
        "https://www.w3.org/2018/credentials/v1",
        "https://w3id.org/security/data-integrity/v2"
    ],
    "type": [
        "VerifiablePresentation"
    ],
    "verifiableCredential": [
        {
            "@context": [
                "https://www.w3.org/2018/credentials/v1",
                "https://www.w3.org/2018/credentials/examples/v1",
                "https://example.org/citizen/v1",
                "https://w3id.org/security/data-integrity/v2"
            ],
            "credentialSubject": {
                "birthDate": "22 06 1991",
                "documentNumber": "14006686 1 ZX8",
                "id": "did:example:citizen:e41f732a-1b43-48c9-b787-ef95a93084b1",
                "name": "DANIEL FERREIRA MACIEL"
            },
            "expirationDate": "2026-06-03T15:53:20.196Z",
            "id": "urn:uuid:c355d057-787c-4584-a9a3-e6291376dcaa",
            "issuanceDate": "2025-06-03T15:53:20.196Z",
            "issuer": "did:key:zDnaetL6FMXdyCQ3YLHs54RM8e7Q2HDVrd16eBiLLRqnhfhqZ",
            "proof": {
                "created": "2025-06-03T15:53:20Z",
                "cryptosuite": "ecdsa-rdfc-2019",
                "proofPurpose": "assertionMethod",
                "proofValue": "z4qUzxxWsHKPiwiNcMdGyzbeHRCEUNqamBMS4YWhH5zze5dPsUQRko7h3DDwUu2awYBd3L2EWE1Mg3cqkTodpq2UG",
                "type": "DataIntegrityProof",
                "verificationMethod": "did:key:zDnaetL6FMXdyCQ3YLHs54RM8e7Q2HDVrd16eBiLLRqnhfhqZ#zDnaetL6FMXdyCQ3YLHs54RM8e7Q2HDVrd16eBiLLRqnhfhqZ"
            },
            "type": [
                "VerifiableCredential",
                "CitizenCredential"
            ]
        }
    ],
    "holder": "did:web:ua.pt:holder:student:456",
    "proof": {
        "type": "DataIntegrityProof",
        "created": "2025-06-03T20:19:00Z",
        "verificationMethod": "did:web:example.org:issuer:123#zDnaetL6FMXdyCQ3YLHs54RM8e7Q2HDVrd16eBiLLRqnhfhqZ",
        "cryptosuite": "ecdsa-rdfc-2019",
        "proofPurpose": "authentication",
        "challenge": "challenge-736345704085865c619dbe977bf17c93",
        "domain": "https://example.com/",
        "proofValue": "z2V7DQxhwYCK4kyCXTHVK5mWnMxjALY5two8RbsWmTErPEKgfQWmmyVjAXqS8u8ZXxUCX1ogAdCo6nHJfSeypHZzk"
    }
};

/**
 * This script tests the VC request endpoint with the refactored code
 * It simulates a login first to get a session token, then uses that token to request a VC
 */
async function testVCRequest() {
    try {
        console.log('Testing VC request with refactored code...');
        
        // First, we need to login to get a session token
        console.log('Step 1: Logging in to get a session token...');
        const loginResponse = await axios.post('http://localhost:3000/api/login/verify', {
            presentation: sampleVP
        });
        
        if (!loginResponse.data.success || !loginResponse.data.token) {
            console.error('Login failed:', loginResponse.data);
            return;
        }
        
        const sessionToken = loginResponse.data.token;
        console.log('Login successful, got session token:', sessionToken);
        
        // Now request an employee credential
        console.log('Step 2: Requesting employee credential...');
        const vcResponse = await axios.post('http://localhost:3000/api/vc/request', {
            sessionToken,
            type: 'Employee'
        });
        
        console.log('VC request response:', vcResponse.data);
        
        if (vcResponse.data.success) {
            console.log('SUCCESS: Employee credential issued successfully!');
            console.log('Credential:', vcResponse.data.credential);
        } else {
            console.log('FAILURE: Employee credential issuance failed.');
            console.log('Error:', vcResponse.data.message);
        }
    } catch (error) {
        console.error('Error testing VC request:', error.response ? error.response.data : error.message);
    }
}

// Run the test
testVCRequest();

console.log('To run this test, make sure the server is running and execute:');
console.log('npx ts-node src/scripts/test-vc-request.ts');