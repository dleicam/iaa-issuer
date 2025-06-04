import axios from 'axios';

// Sample VP from the issue description with the new structure
const sampleRequest = {
    "presentation": {
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
            "created": "2025-06-03T20:26:35Z",
            "verificationMethod": "did:web:example.org:issuer:123#zDnaetL6FMXdyCQ3YLHs54RM8e7Q2HDVrd16eBiLLRqnhfhqZ",
            "cryptosuite": "ecdsa-rdfc-2019",
            "proofPurpose": "authentication",
            "challenge": "challenge-571b57ee09897eea17c7143f58f00086",
            "domain": "https://example.com/",
            "proofValue": "z3WZVScCULdNPYtbBBGo35fKVMAGDH4BFkX44F7xPLnKKTikmAwoaBK8ecG79mJkhehfnhdWbexinVDGVzwuanzfe"
        }
    },
    "challengeId": "7b7c5c85ffe02c56"
};

/**
 * This script tests the login and VC request flow with the new VP structure
 */
async function testNewVPStructure() {
    try {
        console.log('Testing with new VP structure where presentation is nested...');
        
        // First, we need to login to get a session token
        console.log('Step 1: Logging in with the new VP structure...');
        const loginResponse = await axios.post('http://localhost:3000/api/login', sampleRequest);
        
        if (!loginResponse.data.isAuthenticated || !loginResponse.data.sessionToken) {
            console.error('Login failed:', loginResponse.data);
            return;
        }
        
        const sessionToken = loginResponse.data.sessionToken;
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
        console.error('Error testing new VP structure:', error.response ? error.response.data : error.message);
    }
}

// Run the test
testNewVPStructure();

console.log('To run this test, make sure the server is running and execute:');
console.log('npx ts-node src/scripts/test-new-vp-structure.ts');