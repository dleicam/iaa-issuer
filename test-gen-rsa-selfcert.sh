# Generate private key
openssl genpkey -algorithm RSA -out issuer_rsa_private.pem -pkeyopt rsa_keygen_bits:2048
# Generate self-signed cert
openssl req -new -x509 -key issuer_rsa_private.pem -out issuer_rsa_cert.pem -days 365 -subj "/CN=TestIssuer/O=TestOrg/C=US"