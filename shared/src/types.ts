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

/** Immich tag entity (subset we consume). */
export interface ImmichTag {
  id: string;
  name: string;
  value: string;
  parentId: string | null;
  color?: string | null;
}

/** Immich asset entity (subset we render). */
export interface ImmichAsset {
  id: string;
  type: string;
  originalFileName: string;
  fileCreatedAt: string;
  thumbhash?: string | null;
}

/** Response from POST /api/search/metadata. */
export interface ImmichSearchResponse {
  assets: {
    items: ImmichAsset[];
    count: number;
    total: number;
    nextPage: string | null;
  };
}
