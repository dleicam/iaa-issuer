
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

const resolver = new CachedResolver();
const didKeyDriverMultikey = DidKey.driver();
const didWebDriver = DidWeb.driver();

didKeyDriverMultikey.use({
  multibaseMultikeyHeader: 'zDna',
  fromMultibase: EcdsaMultikey.from
});

didKeyDriverMultikey.use({
  multibaseMultikeyHeader: 'zDnae',
  fromMultibase: EcdsaMultikey.from
});

const originalKeyGet = didKeyDriverMultikey.get.bind(didKeyDriverMultikey);
// @ts-ignore
didKeyDriverMultikey.get = async function({did}) {
  try {
    return await originalKeyGet({did});
  } catch (error) {
    console.log('Original didKeyDriverMultikey.get failed, creating dynamic DID document for:', did);

    const publicKeyMultibase = did.split(':')[2];

    if (!publicKeyMultibase) {
      throw new Error(`Invalid did:key format: ${did}`);
    }

    const didDocument = {
      "@context": [
        "https://www.w3.org/ns/did/v1",
        "https://w3id.org/security/multikey/v1"
      ],
      "id": did,
      "verificationMethod": [
        {
          "id": `${did}#${publicKeyMultibase}`,
          "type": "Multikey",
          "controller": did,
          "publicKeyMultibase": publicKeyMultibase
        }
      ],
      "authentication": [
        `${did}#${publicKeyMultibase}`
      ],
      "assertionMethod": [
        `${did}#${publicKeyMultibase}`
      ]
    };

    return {
      didDocument,
      didDocumentMetadata: {},
      didResolutionMetadata: {}
    };
  }
};

didWebDriver.use({
  multibaseMultikeyHeader: 'zDna',
  fromMultibase: EcdsaMultikey.from
});

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
            "name": { "@id": "https://example.org/name" },
            "publicKeyQualifiedSigned": { "@id": "https://example.org/publicKeyQualifiedSigned" }
          }
        },
        "EmployeeCredential": {
          "@id": "https://example.org/EmployeeCredential",
          "@context": {
            "@version": 1.1,
            "name": { "@id": "https://example.org/name" },
            "employeeId": { "@id": "https://example.org/employeeId" }
          }
        },
        "GraduationCredential": {
          "@id": "https://example.org/GraduationCredential",
          "@context": {
            "@version": 1.1,
            "name": { "@id": "https://example.org/name" },
            "institution": { "@id": "https://schema.org/CollegeOrUniversity" },
            "degree": { "@id": "https://schema.org/EducationalQualification" },
            "field": { "@id": "https://schema.org/fieldOfStudy" },
            "graduationDate": { "@id": "https://schema.org/endDate" },
            "graduationId": { "@id": "https://schema.org/identifier" }
          }
        },
        "birthDate": { "@id": "https://example.org/birthDate" },
        "documentNumber": { "@id": "https://example.org/documentNumber" },
        "name": { "@id": "https://example.org/name" },
        "publicKeyQualifiedSigned": { "@id": "https://example.org/publicKeyQualifiedSigned" },
        "employeeId": { "@id": "https://example.org/employeeId" },
        "institution": { "@id": "https://schema.org/CollegeOrUniversity" },
        "degree": { "@id": "https://schema.org/EducationalQualification" },
        "field": { "@id": "https://schema.org/fieldOfStudy" },
        "graduationDate": { "@id": "https://schema.org/endDate" },
        "graduationId": { "@id": "https://schema.org/identifier" }
      }
    };

    // Add the main citizen context
    loader.addStatic("https://example.org/citizen/v1", citizenContext);

    // Add static entries for credential types and terms in a more concise way
    const simpleContext = {
      "@context": {
        "@version": 1.1
      }
    };

    // Credential types
    loader.addStatic("https://example.org/CitizenCredential", simpleContext);
    loader.addStatic("https://example.org/EmployeeCredential", simpleContext);
    loader.addStatic("https://example.org/GraduationCredential", simpleContext);

    // Citizen credential terms
    loader.addStatic("https://example.org/birthDate", simpleContext);
    loader.addStatic("https://example.org/documentNumber", simpleContext);
    loader.addStatic("https://example.org/name", simpleContext);
    loader.addStatic("https://example.org/publicKeyQualifiedSigned", simpleContext);


    // Employee credential terms
    loader.addStatic("https://example.org/employeeId", simpleContext);

    // Graduation credential terms
    loader.addStatic("https://schema.org/CollegeOrUniversity", simpleContext);
    loader.addStatic("https://schema.org/EducationalQualification", simpleContext);
    loader.addStatic("https://schema.org/fieldOfStudy", simpleContext);
    loader.addStatic("https://schema.org/endDate", simpleContext);
    loader.addStatic("https://schema.org/identifier", simpleContext);

    // Add the graduation context
    loader.addStatic("https://www.w3.org/2018/credentials/graduation/v1", {
      "@context": {
        "@version": 1.1,
        "GraduationCredential": "https://example.org/GraduationCredential",
        "institution": "https://schema.org/CollegeOrUniversity",
        "degree": "https://schema.org/EducationalQualification",
        "field": "https://schema.org/fieldOfStudy",
        "graduationDate": "https://schema.org/endDate",
        "graduationId": "https://schema.org/identifier"
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
  documentLoader = null;
};

export { didKeyDriverMultikey, didWebDriver };
