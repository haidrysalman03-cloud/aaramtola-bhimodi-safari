import manifest from '../../public/content-defaults.json' with { type: 'json' };
export { manifest };
export function validateContent(input) {
  if (!input || typeof input !== 'object' || !input.values || !Array.isArray(input.gallery)) throw new Error('Invalid content.');
  const values = {};
  for (const {key} of manifest.fields) {
    if (typeof input.values[key] !== 'string' || input.values[key].length > 8000) throw new Error('Text fields must be under 8,000 characters.');
    values[key] = input.values[key];
  }
  if (input.gallery.length > 100) throw new Error('Use at most 100 gallery images.');
  const gallery = input.gallery.map(image => {
    if (!image || typeof image.src !== 'string' || !/^(?:assets\/photo-\d{2}\.(?:jpg|jpeg|png)|\/api\/media\/[a-f0-9-]{36}\.(?:jpg|png|webp))$/.test(image.src)) throw new Error('Choose an uploaded image.');
    for (const key of ['alt','caption']) if (typeof image[key] !== 'string' || image[key].length > 500) throw new Error('Image descriptions must be under 500 characters.');
    return {src:image.src,alt:image.alt,caption:image.caption};
  });
  if (!Array.isArray(input.phones) || input.phones.length !== 2 || !input.phones.every(p=>typeof p === 'string' && /^\+[1-9]\d{7,14}$/.test(p))) throw new Error('Use two international phone numbers, starting with +.');
  if (typeof input.whatsapp !== 'string' || !/^[1-9]\d{7,14}$/.test(input.whatsapp)) throw new Error('Use a WhatsApp number with country code and digits only.');
  return {values,gallery,phones:input.phones,whatsapp:input.whatsapp};
}
export function imageExtension(bytes) {
  if (bytes[0]===255 && bytes[1]===216 && bytes[2]===255) return 'jpg';
  if (bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return 'png';
  if (bytes.toString('ascii',0,4)==='RIFF' && bytes.toString('ascii',8,12)==='WEBP') return 'webp';
  throw new Error('Choose a JPEG, PNG or WebP image.');
}
