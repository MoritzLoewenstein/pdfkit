import crypto from 'node:crypto';

class Crypto {
  static md5(data) {
    return crypto.createHash('md5').update(data).digest();
  }

  static sha256(data) {
    return crypto.createHash('sha256').update(data).digest();
  }

  static aesEncrypt(algorithm, key, iv) {
    return crypto.createCipheriv(algorithm, key, iv);
  }

  static aesDecrypt(algorithm, key, iv) {
    return crypto.createDecipheriv(algorithm, key, iv);
  }
}
