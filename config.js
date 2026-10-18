// Edit these before deploying.
export const CHECKOUT_URL = 'https://www.creem.io/payment/prod_3eu3Z1U3VBEy50UN4IEM4M'; // live Creem checkout (test: https://www.creem.io/test/payment/prod_6ik1iF5QOcnv5lBkLHO5pw)
export const PRO_PRICE = '$5';
// mp4-muxer (MIT, Vanilagy) is vendored locally; CDN is the fallback.
export const MP4_MUXER_URLS = ['./mp4-muxer.mjs', 'https://cdn.jsdelivr.net/npm/mp4-muxer@5.2.1/+esm'];
export const WATERMARK_TEXT = 'Made with AutoZoom';
export const LICENSE_API = 'api/license'; // Vercel function in /api
