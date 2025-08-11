// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { Buffer } from 'buffer';

export const apiVersion = "7.2-preview.1";
export const batchApiVersion = "5.0";
export const markdownCommentsApiVersion = "7.2-preview.4";

export function createEnumMapping<T extends Record<string, string | number>>(enumObject: T): Record<string, T[keyof T]> {
  const mapping: Record<string, T[keyof T]> = {};
  for (const [key, value] of Object.entries(enumObject)) {
    if (typeof key === "string" && typeof value === "number") {
      mapping[key.toLowerCase()] = value as T[keyof T];
    }
  }
  return mapping;
}

export function mapStringToEnum<T extends Record<string, string | number>>(value: string | undefined, enumObject: T, defaultValue?: T[keyof T]): T[keyof T] | undefined {
  if (!value) return defaultValue;
  const enumMapping = createEnumMapping(enumObject);
  return enumMapping[value.toLowerCase()] ?? defaultValue;
}

/**
 * Maps an array of strings to an array of enum values, filtering out invalid values.
 * @param values Array of string values to map
 * @param enumObject The enum object to map to
 * @returns Array of valid enum values
 */
export function mapStringArrayToEnum<T extends Record<string, string | number>>(values: string[] | undefined, enumObject: T): Array<T[keyof T]> {
  if (!values) return [];
  return values.map((value) => mapStringToEnum(value, enumObject)).filter((v): v is T[keyof T] => v !== undefined);
}

/**
 * Converts a TypeScript numeric enum to an array of string keys for use with z.enum().
 * This ensures that enum schemas generate string values rather than numeric values.
 * @param enumObject The TypeScript enum object
 * @returns Array of string keys from the enum
 */
export function getEnumKeys<T extends Record<string, string | number>>(enumObject: T): string[] {
  return Object.keys(enumObject).filter((key) => isNaN(Number(key)));
}

/**
 * Safely converts a string enum key to its corresponding enum value.
 * Validates that the key exists in the enum before conversion.
 * @param enumObject The TypeScript enum object
 * @param key The string key to convert
 * @returns The enum value if key is valid, undefined otherwise
 */
export function safeEnumConvert<T extends Record<string, string | number>>(enumObject: T, key: string | undefined): T[keyof T] | undefined {
  if (!key) return undefined;

  const validKeys = getEnumKeys(enumObject);
  if (!validKeys.includes(key)) {
    return undefined;
  }

  return enumObject[key as keyof T];
}

import { WebApi } from "azure-devops-node-api";

/**
 * Generates the appropriate Authorization header value based on server type.
 * For Azure DevOps Services (cloud), uses Bearer authentication.
 * For on-premise/private servers, uses Basic authentication with empty username and token as password.
 * @param serverUrl The Azure DevOps server URL
 * @param token The authentication token
 * @returns The Authorization header value
 */
export function getAuthorizationHeader(serverUrl: string, token: string): string {
  if (serverUrl.includes("dev.azure.com") || serverUrl.includes("vsrm.dev.azure.com")) {
    // Azure DevOps Services (cloud) - use Bearer authentication
    return `Bearer ${token}`;
  } else {
    // On-premise/private servers - use Basic authentication with empty username
    const credentials = `:${token}`;
    const encodedCredentials = Buffer.from(credentials).toString('base64');
    return `Basic ${encodedCredentials}`;
  }
}

export function getServiceBaseUrl(connection: WebApi, serviceType: 'search' | 'identity', orgName: string | undefined): string {
  const serverUrl = connection.serverUrl;

  // For Azure DevOps Services
  if (serverUrl.includes("dev.azure.com")) {
    let org = orgName;
    if (org === undefined) {
        // Fallback: try to extract organization name from dev.azure.com URL
        const parts = serverUrl.split('/');
        if (parts.length >= 4 && parts[2] === 'dev.azure.com') {
            org = parts[3];
        }
    }

    if (org) {
        if (serviceType === 'search') {
            return `https://almsearch.dev.azure.com/${org}`;
        } else if (serviceType === 'identity') {
            return `https://vssps.dev.azure.com/${org}/_apis/identities`;
        }
    }
  }
  // For on-premise or other custom URLs, use connection.serverUrl as base
  // This assumes on-premise serves search/identity APIs directly under the main URL
  return serverUrl;
}
