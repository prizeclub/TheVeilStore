# The Veil Store — Premium Introductory Website

A premium, GitHub Pages-ready introductory website for The Veil Store.

## Pages

- Home
- About Us
- Contact Us

No product catalogue, shop, cart, or extra public pages are included.

## Adding gallery photos

The Home page uses an owner-controlled gallery. Put your photographs in:

`assets/gallery/`

Use names such as:

- `gallery-01.jpg`
- `gallery-02.jpg`
- `gallery-03.webp`
- `gallery-04.png`

The website automatically checks for `gallery-01` through `gallery-100`, supports JPG/JPEG/PNG/WEBP, and ignores files that are not present. No JavaScript editing is needed for the simple owner workflow.

The gallery initially shows 12 photographs and reveals more with the “View more moments” button. Each image opens in a full-screen lightbox.

If you later want custom captions and exact layout control, `gallery-data.js` supports manual entries.

## GitHub Pages

1. Upload the contents of this folder to your GitHub repository.
2. Commit your changes.
3. In GitHub, open **Settings → Pages**.
4. Select **Deploy from a branch** and choose your main branch/root folder.
5. Save and wait for GitHub Pages to publish.

When adding new photos later, upload them to `assets/gallery/` and commit the changes. GitHub Pages will publish them with the next deployment.

## Contact details configured

- Email: theveilstore.mumbai@gmail.com
- Phone / WhatsApp: +91 73806 70402
- Address: Gorai 2, Borivali West, Mumbai-400092

## Giveaway

The Giveaway is intentionally kept out of the Home page. It is accessible from the footer under **Explore → Giveaway** and opens as a modal.
