ABASS COMPLETE WEBSITE

Static multi-page website generated from the supplied ABASS landing page.

Pages:
- index.html — Home / complete landing page
- about.html — About ABASS
- objects.html — Objects of the Trust
- events.html — Events & Pooja
- devotional.html — Pooja & Devotional Library
- donations.html — Donations & Causes
- media.html — Media
- transparency.html — Board of Trustees & Trust Records
- contact.html — Connect + WhatsApp enquiry form

Shared assets:
- assets/styles.css
- assets/script.js

The English/Tamil switch is retained from the source page. The contact enquiry form opens WhatsApp using the configured ABASS contact number.

Run locally by opening index.html or serving this folder with any static web server.

================================================================
DEVOTIONAL UPDATE — September 2026
================================================================

WHAT CHANGED

1. Mobile hero badge fixed
   The "Temple Service, Food & Education for All" badge was a fixed
   104px circle (78px on phones) holding a full sentence, with an
   inline font-size override. The text spilled outside the ring.
   It is now a self-sizing gold ribbon centred under the image.

2. Lord Ayyappa image now leads the mobile hero
   On phones the darshan panel moves above the headline text, goes
   near full-width (was a 260px thumbnail), and carries a caption
   overlay: "Divine Darshan / Lord Ayyappa - devotion carried
   forward through every generation". The caption follows the
   slideshow and switches with the EN/TA language toggle.

3. New "Seva Sankalpam" sponsor dropdown section
   Added to index.html (immediately after the hero, so it is the
   second section on mobile) and to donations.html.
   - Grouped dropdown of 11 sevas, bilingual
   - Live detail card: amount, description, what the sponsor receives
   - Quick amount chips plus an "other amount" field
   - Sankalpam fields, sends a formatted WhatsApp message
   To edit the seva list, amounts or perks, see the SEVAS array
   near the top of assets/_devotional.js.

4. Devotional styling across all 10 pages
   - Google Fonts (Cinzel / Work Sans / Noto Tamil) were referenced
     in the CSS but never actually loaded. Now linked on every page.
   - Scrolling "Swamiye Saranam Ayyappa" chant strip under the header
   - Kolam dot texture, gold ornamental dividers, garland-gradient
     image frames, breathing lamp icons, halo glows

NEW FILES
   assets/_devotional.css   all new styling and mobile fixes
   assets/_devotional.js    hero caption + seva sponsor dropdown
Both load after the originals, so styles.css and script.js are
untouched and the changes can be removed by deleting the two
<link>/<script> tags.

CONTACT NUMBER
   The WhatsApp number 919841820668 appears in assets/script.js and
   assets/_devotional.js (PHONE constant). Change it in both places.

TESTED
   Chromium at 360px, 390px, 768px and 1440px across all 10 pages:
   no horizontal overflow, no JavaScript errors, EN/TA switching
   verified on the new dropdown and hero caption.

================================================================
REVIEW ROUND — 19 September 2026
================================================================
1. Header name on every page now reads "Abhath Bhanthavan Ayyappa
   Seva Sangham" (was "Ayyappa Seva Sangham Trust").
2. "80 years" removed: About-page hero wording, and the 80-year
   emblem retouched out of assets/images/gallery-15.jpg (the poster).
3. Seva Sankalpam now lists ONLY upcoming events (same four as
   events.html). Edit the SEVAS array in assets/_devotional.js.
   Items with data-until="YYYY-MM-DD" (events.html, mobile bar) and
   `until` in SEVAS disappear automatically after that date.
4. All donation amounts removed (Sankalpam form, Donations page cards,
   WhatsApp messages). The Events-page "Contribute" form still has a
   typed "Amount" field for reconciliation.
5. Home page: duplicate giving-journey block removed (it lives on
   donations.html). Mobile bar options = General, Social Welfare and
   the upcoming events.
6. Objects of the Trust: all 45 deed clauses, grouped in 6 categories
   (objects.html full list; home shows summaries + links). Clauses
   (x) and (z) are identical in the deed and shown together.
7. Media: filters are now event folders (18 Padi Pooja, Thiru Vilakku
   Pooja, Annadhaanam, Maha Abhishekam, Mandala Pooja & Utsavam).
   A photo can sit in more than one folder via data-category.

================================================================
REVIEW ROUND — 21 September 2026
================================================================
1. Mobile hero: removed the `order:-1` rule that made the darshan
   image lead on phones. Content (title, tagline, description,
   buttons) now shows first, the image slideshow second — same fix
   applied to the Seva Sankalpam panel (form now leads, photo follows).
2. Hero tagline ("Ayyappa Seva • Devotion • Service") is now bold
   and slightly larger for stronger visual presence.
3. "Sankalpam details" section label renamed to "Donor details"
   (index.html + donations.html form, and the donations-page giving
   journey step "Provide Devotional Sankalpam Details" -> "Provide
   Donor Details"). The word "sankalpam" itself is kept elsewhere
   where it refers to the actual pooja ritual.
4. Seva Sankalpam form no longer opens WhatsApp on submit. It now
   shows an on-page "Thank you" confirmation and resets the form;
   nothing is sent automatically. A Trustee is expected to follow up
   with the devotee directly. The PHONE constant and wa.me call were
   removed from assets/_devotional.js accordingly. (The separate
   "Contribute Towards an Event" WhatsApp form on events.html is
   unchanged.)
