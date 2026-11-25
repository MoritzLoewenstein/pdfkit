/**
 * @export
 * @async
 * @param {import("./document").default} doc
 * @returns {Promise<ArrayBuffer>}
 */
export async function documentToArrayBuffer(doc) {
  const resp = new Response(doc.stream);
  return resp.arrayBuffer();
}

/**
 * @export
 * @async
 * @param {import("./document").default} doc
 * @returns {Promise<Blob>}
 */
export async function documentToBlob(doc) {
  const resp = new Response(doc.stream, {
    headers: {
      'Content-Type': 'application/pdf',
    },
  });
  return resp.blob();
}

export { documentToBlob as toBlob };

export async function toBytes(doc) {
  return new Uint8Array(await documentToArrayBuffer(doc));
}
