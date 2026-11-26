package com.tradechameleon.identity;

import com.nimbusds.jose.jwk.JWKSet;
import com.nimbusds.jose.jwk.KeyUse;
import com.nimbusds.jose.jwk.RSAKey;
import java.security.KeyPairGenerator;
import java.security.NoSuchAlgorithmException;
import java.security.interfaces.RSAPrivateKey;
import java.security.interfaces.RSAPublicKey;
import java.util.UUID;

/**
 * RSA key pair of the built-in development identity provider. Generated at startup, so tokens do not
 * survive a restart (clients simply log in again). The public half is published at {@code /oauth2/jwks}.
 */
public final class DevSigningKey {

    private final RSAKey rsaKey;

    private DevSigningKey(RSAKey rsaKey) {
        this.rsaKey = rsaKey;
    }

    static DevSigningKey generate() {
        try {
            var generator = KeyPairGenerator.getInstance("RSA");
            generator.initialize(2048);
            var pair = generator.generateKeyPair();
            var key = new RSAKey.Builder((RSAPublicKey) pair.getPublic())
                    .privateKey((RSAPrivateKey) pair.getPrivate())
                    .keyUse(KeyUse.SIGNATURE)
                    .algorithm(com.nimbusds.jose.JWSAlgorithm.RS256)
                    .keyID("tc-dev-" + UUID.randomUUID().toString().substring(0, 8))
                    .build();
            return new DevSigningKey(key);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    RSAKey rsaKey() {
        return rsaKey;
    }

    RSAPublicKey publicKey() {
        try {
            return rsaKey.toRSAPublicKey();
        } catch (com.nimbusds.jose.JOSEException e) {
            throw new IllegalStateException(e);
        }
    }

    /** Public keys only: safe to expose. */
    JWKSet publicJwkSet() {
        return new JWKSet(rsaKey.toPublicJWK());
    }
}
