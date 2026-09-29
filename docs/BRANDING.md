# Branding and feature configuration

Edit `config/brand.json` for this installation's name, description, logoPath, legalName, supportEmail, siteUrl, shopUrl, accentColor/accentColorDark, locale, timeZone, senderName/senderSetup and features. These are public display settings; never store credentials here.

- `googleLogin`: false by default. Enable only after configuring this installation's Google provider and exact callback URL in its own Supabase project. The button is absent while false.
- `passwordLogin`: email/password UI and profile password settings. Email-code sign-in remains available.
- `passwordSetup`: when password login is enabled, new email users choose a password before onboarding. Existing completed profiles retain their routing and progress; Google users proceed to onboarding. The metadata flag controls the journey only and never grants access.
- `readingCompanions`: enables the reading component. Server delivery additionally requires `KSDA_READING_DELIVERY_ENABLED=true` and a locally installed/activated matching content release. Missing configuration falls back to existing lessons.

An empty shopUrl omits shop links. Empty supportEmail omits email links. Neutral example URLs are placeholders, not a shared service. Replace the logo with assets you have rights to use, retaining copyright/attribution notices. The framework's internal `data-capai-theme` CSS selector is a compatibility name only; it has no CAPAi network or identity dependency.

Theme colours need contrast review after every brand change. Both EN/BM strings are supported, not automatic translation of arbitrary new content. `senderName` and `senderSetup` guide maintenance; they do not change SMTP provider settings. Configure the actual sender privately in the independent provider dashboard.

Course presentation is configured in `config/course-catalogue.json`; reading and video content have their own validated package/config files described in MODULES.md. No CAPAi logo, production account or operational endpoint is a framework default. Optional teaching examples retain their original intellectual-property notices and restrictions.
