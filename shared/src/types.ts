// SPDX-License-Identifier: AGPL-3.0-or-later

/** Immich login response (subset we care about). */
export interface ImmichLoginResponse {
  accessToken: string;
  userId: string;
  userEmail: string;
  name: string;
  isAdmin: boolean;
}

/** Immich /users/me response (subset). */
export interface ImmichUserMe {
  id: string;
  email: string;
  name: string;
  isAdmin: boolean;
  avatarColor: string;
}

/** Our signed session cookie payload. */
export interface SessionPayload {
  accessToken: string;
  userId: string;
  userEmail: string;
}
