/*
   PDFSecurity - represents PDF security settings
   By Yang Liu <hi@zesik.com>
 */

import { concatBytes } from '@noble/hashes/utils.js';
import { aesCbcEncrypt, aesEcbEncrypt } from './crypto/aes';
import { md5Hash } from './crypto/md5';
import randomBytes from './crypto/random';
import sha256Hash from './crypto/sha256';
import saslprep from './saslprep/index';

class PDFSecurity {
  static generateFileID(info = {}) {
    let infoStr = `${info.CreationDate.getTime()}\n`;

    for (let key in info) {
      if (!Object.hasOwn(info, key)) {
        continue;
      }
      infoStr += `${key}: ${info[key]}\n`;
    }

    return md5Hash(new TextEncoder().encode(infoStr));
  }

  static generateRandomWordArray(bytes) {
    return randomBytes(bytes);
  }

  static create(document, options = {}) {
    if (!options.ownerPassword && !options.userPassword) {
      return null;
    }
    if (options.pdfVersion !== '1.7ext3') {
      throw new Error("Password protection requires pdfVersion: '1.7ext3'");
    }
    return new PDFSecurity(document, options);
  }

  constructor(document, options) {
    const permissions = getPermissions(options.permissions);

    const processedUserPassword = processPasswordR5(options.userPassword);
    const processedOwnerPassword = options.ownerPassword
      ? processPasswordR5(options.ownerPassword)
      : processedUserPassword;

    this.encryptionKey = getEncryptionKeyR5(
      PDFSecurity.generateRandomWordArray,
    );
    const userPasswordEntry = getUserPasswordR5(
      processedUserPassword,
      PDFSecurity.generateRandomWordArray,
    );
    const userKeySalt = userPasswordEntry.slice(40, 48);
    const userEncryptionKeyEntry = getUserEncryptionKeyR5(
      processedUserPassword,
      userKeySalt,
      this.encryptionKey,
    );
    const ownerPasswordEntry = getOwnerPasswordR5(
      processedOwnerPassword,
      userPasswordEntry,
      PDFSecurity.generateRandomWordArray,
    );
    const ownerKeySalt = ownerPasswordEntry.slice(40, 48);
    const ownerEncryptionKeyEntry = getOwnerEncryptionKeyR5(
      processedOwnerPassword,
      ownerKeySalt,
      userPasswordEntry,
      this.encryptionKey,
    );
    const permsEntry = getEncryptedPermissionsR5(
      permissions,
      this.encryptionKey,
      PDFSecurity.generateRandomWordArray,
    );

    this.dictionary = document.ref({
      Filter: 'Standard',
      V: 5,
      Length: 256,
      CF: {
        StdCF: {
          AuthEvent: 'DocOpen',
          CFM: 'AESV3',
          Length: 32,
        },
      },
      StmF: 'StdCF',
      StrF: 'StdCF',
      R: 5,
      O: ownerPasswordEntry,
      OE: ownerEncryptionKeyEntry,
      U: userPasswordEntry,
      UE: userEncryptionKeyEntry,
      P: permissions,
      Perms: permsEntry,
    });
  }

  getEncryptFn() {
    const key = this.encryptionKey;
    return (buffer) => {
      const iv = PDFSecurity.generateRandomWordArray(16);
      const encrypted = aesCbcEncrypt(buffer, key, iv, true);
      return concatBytes(iv, encrypted);
    };
  }

  end() {
    this.dictionary.end();
  }
}

function getPermissions(permissionObject = {}) {
  let permissions = 0xfffff0c0 >> 0;
  if (permissionObject.printing === 'lowResolution') {
    permissions |= 0b000000000100;
  }
  if (permissionObject.printing === 'highResolution') {
    permissions |= 0b100000000100;
  }
  if (permissionObject.modifying) {
    permissions |= 0b000000001000;
  }
  if (permissionObject.copying) {
    permissions |= 0b000000010000;
  }
  if (permissionObject.annotating) {
    permissions |= 0b000000100000;
  }
  if (permissionObject.fillingForms) {
    permissions |= 0b000100000000;
  }
  if (permissionObject.contentAccessibility) {
    permissions |= 0b001000000000;
  }
  if (permissionObject.documentAssembly) {
    permissions |= 0b010000000000;
  }
  return permissions;
}

function getUserPasswordR5(processedUserPassword, generateRandomWordArray) {
  const validationSalt = generateRandomWordArray(8);
  const keySalt = generateRandomWordArray(8);
  const hash = sha256Hash(concatBytes(processedUserPassword, validationSalt));
  return concatBytes(hash, validationSalt, keySalt);
}

function getUserEncryptionKeyR5(
  processedUserPassword,
  userKeySalt,
  encryptionKey,
) {
  const key = sha256Hash(concatBytes(processedUserPassword, userKeySalt));
  const iv = new Uint8Array(16); // Zero IV
  return aesCbcEncrypt(encryptionKey, key, iv, false);
}

function getOwnerPasswordR5(
  processedOwnerPassword,
  userPasswordEntry,
  generateRandomWordArray,
) {
  const validationSalt = generateRandomWordArray(8);
  const keySalt = generateRandomWordArray(8);
  const hash = sha256Hash(
    concatBytes(processedOwnerPassword, validationSalt, userPasswordEntry),
  );
  return concatBytes(hash, validationSalt, keySalt);
}

function getOwnerEncryptionKeyR5(
  processedOwnerPassword,
  ownerKeySalt,
  userPasswordEntry,
  encryptionKey,
) {
  const key = sha256Hash(
    concatBytes(processedOwnerPassword, ownerKeySalt, userPasswordEntry),
  );
  const iv = new Uint8Array(16); // Zero IV
  return aesCbcEncrypt(encryptionKey, key, iv, false);
}

function getEncryptionKeyR5(generateRandomWordArray) {
  return generateRandomWordArray(32);
}

function getEncryptedPermissionsR5(
  permissions,
  encryptionKey,
  generateRandomWordArray,
) {
  // Build 16-byte block: permissions (4 bytes LSB) + 0xFFFFFFFF (4 bytes) + "adbT" (4 bytes) + random (4 bytes)
  const data = new Uint8Array(16);
  // Permissions (LSB first)
  data[0] = permissions & 0xff;
  data[1] = (permissions >> 8) & 0xff;
  data[2] = (permissions >> 16) & 0xff;
  data[3] = (permissions >> 24) & 0xff;
  // 0xFFFFFFFF
  data[4] = 0xff;
  data[5] = 0xff;
  data[6] = 0xff;
  data[7] = 0xff;
  // "adbT" = 0x54616462 (but stored as individual bytes)
  data[8] = 0x54; // 'T'
  data[9] = 0x61; // 'a'
  data[10] = 0x64; // 'd'
  data[11] = 0x62; // 'b'
  // Random 4 bytes
  const randomPart = generateRandomWordArray(4);
  data.set(randomPart, 12);

  return aesEcbEncrypt(data, encryptionKey);
}

function processPasswordR5(password = '') {
  password = unescape(encodeURIComponent(saslprep(password)));
  const length = Math.min(127, password.length);
  const out = new Uint8Array(length);

  for (let i = 0; i < length; i++) {
    out[i] = password.charCodeAt(i);
  }

  return out;
}

export default PDFSecurity;
