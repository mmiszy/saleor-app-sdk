import * as jose from "jose";

import { createDebug } from "./debug";
import { hasPermissionsInJwtToken } from "./has-permissions-in-jwt-token";
import { AppPermission } from "./types";
import { getJwksUrlFromSaleorApiUrl } from "./urls";

const debug = createDebug("verify-jwt");

export interface DashboardTokenPayload extends jose.JWTPayload {
  app: string;
  user_permissions: AppPermission[];
}

export interface verifyJWTArguments {
  appId: string;
  saleorApiUrl: string;
  token: string;
  requiredPermissions?: AppPermission[];
}

export const verifyJWT = async ({
  saleorApiUrl,
  token,
  appId,
  requiredPermissions,
}: verifyJWTArguments) => {
  let tokenClaims: DashboardTokenPayload;
  const ERROR_MESSAGE = "JWT verification failed:";

  try {
    tokenClaims = jose.decodeJwt(token as string) as DashboardTokenPayload;
    debug("Token Claims decoded from jwt");
  } catch (e) {
    debug("Token Claims could not be decoded from JWT, will respond with Bad Request");
    throw new Error(`${ERROR_MESSAGE} Could not decode authorization token.`);
  }

  if (tokenClaims.app !== appId) {
    debug(
      "Resolved App ID value from token to be different than in request, will respond with Bad Request"
    );

    throw new Error(`${ERROR_MESSAGE} Token's app property is different than app ID.`);
  }

  if (!hasPermissionsInJwtToken(tokenClaims, requiredPermissions)) {
    debug("Token did not meet requirements for permissions: %s", requiredPermissions);
    throw new Error(`${ERROR_MESSAGE} Token's permissions are not sufficient.`);
  }

  try {
    debug("Trying to create JWKS");

    const JWKS = jose.createRemoteJWKSet(new URL(getJwksUrlFromSaleorApiUrl(saleorApiUrl)));
    debug("Trying to compare JWKS with token");
    await jose.jwtVerify(token, JWKS);
  } catch (e) {
    debug("Failure: %s", e);
    debug("Will return with Bad Request");

    console.error(e);

    throw new Error(`${ERROR_MESSAGE} JWT signature verification failed.`);
  }
};
