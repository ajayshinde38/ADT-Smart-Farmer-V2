# Fertilizer UI — 5 November 2026

- Replaced dense desktop-style active-dose and schedule presentations with app theme cards, green accents, readable product rows, farm quantities, recorded status, and nutrient summaries. Layout fits a 390 px mobile viewport without horizontal table scrolling.
- Marathi product-name and mass-unit presentation shared by the banner, schedule, login popup, and FertiNex plan preview. Backend product identifiers, numeric quantities and NPK grades remain unchanged. Water details remain visible.
- Farmer navigator displays a dismissible fertilizer-advice modal after successful login/profile selection. It loads the selected farm's protected schedule. Loading, retry and no-active-dose states are explicit. Viewing full advice opens Advisory. The popup cannot mark a dose applied.
- Dismissal persists while navigating tabs in the current session. A new login or selected farm remount shows the welcome modal again. Late responses from an old farm are ignored. Authentication and administrator flows were not changed.
- Removed hardcoded display fallback fertilizer quantities/area from the replaced components; missing values display as unavailable. Application actions remain explicit buttons, with saving/error states.

Verification: TypeScript check and fertilizer display test script pass. Expo web export succeeds. Isolated synthetic component preview visually checked at 390×844: Marathi names/units, preserved numeric grades, light-card styling, scrollable modal with fixed action buttons, dismissal/full-advisory action, and switching back to English. Preview used no credentials or live farm API writes. The real post-login flow was not completed with a farmer account in this check.

`ComponentPreview.tsx` is a synthetic preview entry intended to be copied into the frontend root for a temporary isolated export. It is not the application entry. Normal entry restored to `index.js` after the preview export.
