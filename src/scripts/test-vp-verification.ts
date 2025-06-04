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

async function testVPVerification() {
    try {
        console.log('Testing VP verification with employee name extraction...');
        
        // Send the VP to the verification endpoint
        const response = await axios.post('http://localhost:3000/api/verification', {
            presentation: sampleVP
        });
        
        console.log('Verification response:', response.data);
        
        // Check if the employee name was correctly extracted
        if (response.data.employeeName === 'DANIEL FERREIRA MACIEL') {
            console.log('SUCCESS: Employee name was correctly extracted!');
        } else {
            console.log('FAILURE: Employee name was not correctly extracted.');
            console.log('Expected: DANIEL FERREIRA MACIEL');
            console.log('Received:', response.data.employeeName);
        }
    } catch (error) {
        console.error('Error testing VP verification:', error.response ? error.response.data : error.message);
    }
}

// Run the test
testVPVerification();

console.log('To run this test, make sure the server is running and execute:');
console.log('npx ts-node src/scripts/test-vp-verification.ts');