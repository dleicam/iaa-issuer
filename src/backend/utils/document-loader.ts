
// @ts-ignore
import * as DidKey from '@digitalbazaar/did-method-key';
// @ts-ignore
import * as DidWeb from '@digitalbazaar/did-method-web';
// @ts-ignore
import * as EcdsaMultikey from '@digitalbazaar/ecdsa-multikey';
// @ts-ignore
import {CachedResolver} from '@digitalbazaar/did-io';
// @ts-ignore
import {securityLoader} from '@digitalbazaar/security-document-loader';
// @ts-ignore
import {contexts as diContexts} from '@digitalbazaar/data-integrity-context';

const loader = securityLoader();
loader.addDocuments({documents: diContexts});

const exampleIssuerDidDocument = {
  "@context": [
    "https://www.w3.org/ns/did/v1",
    "https://w3id.org/security/multikey/v1"
  ],
  "id": "did:web:example.org:issuer:123",
  "verificationMethod": [
    {
      "id": "did:web:example.org:issuer:123#zDnaetL6FMXdyCQ3YLHs54RM8e7Q2HDVrd16eBiLLRqnhfhqZ",
      "type": "Multikey",
      "controller": "did:web:example.org:issuer:123",
      "publicKeyMultibase": "zDnaetL6FMXdyCQ3YLHs54RM8e7Q2HDVrd16eBiLLRqnhfhqZ"
    }
  ],
  "authentication": [
    "did:web:example.org:issuer:123#zDnaetL6FMXdyCQ3YLHs54RM8e7Q2HDVrd16eBiLLRqnhfhqZ"
  ],
  "assertionMethod": [
    "did:web:example.org:issuer:123#zDnaetL6FMXdyCQ3YLHs54RM8e7Q2HDVrd16eBiLLRqnhfhqZ"
  ],
  "keyAgreement": [
    "did:web:example.org:issuer:123#zDnaetL6FMXdyCQ3YLHs54RM8e7Q2HDVrd16eBiLLRqnhfhqZ"
  ],
  "capabilityInvocation": [
    "did:web:example.org:issuer:123#zDnaetL6FMXdyCQ3YLHs54RM8e7Q2HDVrd16eBiLLRqnhfhqZ"
  ],
  "capabilityDelegation": [
    "did:web:example.org:issuer:123#zDnaetL6FMXdyCQ3YLHs54RM8e7Q2HDVrd16eBiLLRqnhfhqZ"
  ]
};

const resolver = new CachedResolver();
const didKeyDriverMultikey = DidKey.driver();
const didWebDriver = DidWeb.driver();

didKeyDriverMultikey.use({
  multibaseMultikeyHeader: 'zDna',
  fromMultibase: EcdsaMultikey.from
});

// Add support for zDnae header format (ECDSA P-256)
didKeyDriverMultikey.use({
  multibaseMultikeyHeader: 'zDnae',
  fromMultibase: EcdsaMultikey.from
});

// Add support for z6LS header format (X25519 key agreement)
didKeyDriverMultikey.use({
  multibaseMultikeyHeader: 'z6LS',
  fromMultibase: EcdsaMultikey.from
});

// Add support for z6Mk header format (Ed25519)
didKeyDriverMultikey.use({
  multibaseMultikeyHeader: 'z6Mk',
  fromMultibase: EcdsaMultikey.from
});

didWebDriver.use({
  multibaseMultikeyHeader: 'zDna',
  fromMultibase: EcdsaMultikey.from
});

// P-384
didWebDriver.use({
  multibaseMultikeyHeader: 'z82L',
  fromMultibase: EcdsaMultikey.from
});

// Override the didWebDriver's get method to provide static DID documents for example.org
const originalGet = didWebDriver.get.bind(didWebDriver);
// @ts-ignore
didWebDriver.get = async function({did}) {
  if (did === 'did:web:example.org:issuer:123') {
    console.log('Providing static DID document for:', did);
    return {
      didDocument: exampleIssuerDidDocument,
      didDocumentMetadata: {},
      didResolutionMetadata: {}
    };
  }
  return originalGet({did});
};

resolver.use(didKeyDriverMultikey);
resolver.use(didWebDriver);
loader.setDidResolver(resolver);

const initializeLoader = async () => {
  try {
    loader.addStatic(
        "https://www.w3.org/ns/odrl.jsonld",
        await fetch("https://www.w3.org/ns/odrl.jsonld").then(res => res.json())
    );

    loader.addStatic(
        "https://www.w3.org/2018/credentials/examples/v1",
        await fetch("https://www.w3.org/2018/credentials/examples/v1").then(res => res.json())
    );

    const credentialsContext = await fetch("https://www.w3.org/2018/credentials/v1").then(res => res.json());
    loader.addStatic("https://www.w3.org/2018/credentials/v1", credentialsContext);

    const securityContext = await fetch("https://w3id.org/security/v2").then(res => res.json());
    loader.addStatic("https://w3id.org/security/v2", securityContext);

    const citizenContext = {
      "@context": {
        "@version": 1.1,
        "CitizenCredential": {
          "@id": "https://example.org/CitizenCredential",
          "@context": {
            "@version": 1.1,
            "birthDate": { "@id": "https://example.org/birthDate" },
            "documentNumber": { "@id": "https://example.org/documentNumber" },
            "name": { "@id": "https://example.org/name" }
          }
        },
        "birthDate": { "@id": "https://example.org/birthDate" },
        "documentNumber": { "@id": "https://example.org/documentNumber" },
        "name": { "@id": "https://example.org/name" }
      }
    };

    // Add the main citizen context
    loader.addStatic("https://example.org/citizen/v1", citizenContext);

    // Also add static entries for each individual term to ensure they're properly cached
    loader.addStatic("https://example.org/CitizenCredential", {
      "@context": {
        "@version": 1.1
      }
    });

    loader.addStatic("https://example.org/birthDate", {
      "@context": {
        "@version": 1.1
      }
    });

    loader.addStatic("https://example.org/documentNumber", {
      "@context": {
        "@version": 1.1
      }
    });

    // Add static DID document for example.org issuer to avoid real network calls
    loader.addStatic("https://example.org/issuer/123/did.json", exampleIssuerDidDocument);

    // Also add the verification method directly
    loader.addStatic("did:web:example.org:issuer:123#zDnaetL6FMXdyCQ3YLHs54RM8e7Q2HDVrd16eBiLLRqnhfhqZ", {
      "@context": "https://w3id.org/security/multikey/v1",
      "id": "did:web:example.org:issuer:123#zDnaetL6FMXdyCQ3YLHs54RM8e7Q2HDVrd16eBiLLRqnhfhqZ",
      "type": "Multikey",
      "controller": "did:web:example.org:issuer:123",
      "publicKeyMultibase": "zDnaetL6FMXdyCQ3YLHs54RM8e7Q2HDVrd16eBiLLRqnhfhqZ"
    });

    // Add the DID document itself
    loader.addStatic("did:web:example.org:issuer:123", exampleIssuerDidDocument);

    loader.addStatic("https://example.org/name", {
      "@context": {
        "@version": 1.1
      }
    });
  } catch (error) {
    console.error("Error loading contexts:", error);
    throw error;
  }
};

let documentLoader: any;

export const getDocumentLoader = async () => {
  if (documentLoader) {
    return documentLoader;
  }

  await initializeLoader();
  documentLoader = loader.build();
  return documentLoader;
};

export const addStaticContext = (url: any, context: any) => {
  loader.addStatic(url, context);
  // Rebuild the document loader to include the new context
  documentLoader = null;
};

export { didKeyDriverMultikey, didWebDriver };