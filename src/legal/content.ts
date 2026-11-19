// TechBlob's legal pages, written once. The site's /legal/<page> routes render this, and scripts/build-legal.mjs
// writes the same text to legal/*.html for www.kavarollc.com/legal/techblob/ (published only after the founder's OK).
// Plain TypeScript with no imports, so Node reads it directly for the HTML build and the tests.

export const LEGAL_UPDATED = "November 19, 2026";
export const CONTACT = "info@kavarollc.com";

export type Block = string | { list: string[] };
export type LegalSlug = "privacy" | "terms" | "dmca" | "delete-account" | "support";
export interface LegalPage {
  slug: LegalSlug;
  title: string;
  intro: string;
  sections: { title: string; body: Block[] }[];
}

export const PAGES: LegalPage[] = [
  {
    slug: "privacy",
    title: "Privacy Policy",
    intro: `TechBlob is a tech video site made by Kavaro LLC. This policy says what TechBlob keeps, why, who else handles it, and how to delete it. Questions: ${CONTACT}.`,
    sections: [
      {
        title: "What TechBlob keeps",
        body: [
          {
            list: [
              "Account: email, username, a hashed password, and whether you are staff.",
              "What you post: comments, videos you submit, reports you make and people you block.",
              "Viewing: a daily-salted fingerprint of each view (never your raw IP address), how far you watched, and your country, used to count views and rank Trending.",
            ],
          },
        ],
      },
      {
        title: "Who else handles it",
        body: [
          "The database host stores accounts and comments. Videos submitted as YouTube links play through YouTube's own embedded player, which follows YouTube's privacy policy. Uploaded video files are stored with a cloud storage and delivery provider.",
          "Ad slots currently show cards for Kavaro's own apps. They don't track you.",
          "We don't sell your personal information and don't share it for advertising.",
        ],
      },
      {
        title: "Your choices",
        body: [
          "Account > Delete account removes your account and everything tied to it right away.",
          `You can also email ${CONTACT} for a copy of your data or to delete it. If you live in California or another state with privacy rights, you have these rights too, and we won't treat you differently for using them.`,
        ],
      },
      { title: "Who can use TechBlob", body: ["TechBlob accounts are for adults 18 and over."] },
      { title: "Changes", body: ["If this policy changes, the date above changes and we say what changed on the site before it applies."] },
    ],
  },
  {
    slug: "terms",
    title: "Terms of Service",
    intro: `These terms are an agreement between you and Kavaro LLC, which runs TechBlob. By creating an account you agree to them. Notices: ${CONTACT}. These terms are pending legal review.`,
    sections: [
      { title: "1. You must be 18 or older", body: ["You must be 18 or older to create an account, comment or submit videos."] },
      { title: "2. What you post", body: ["Post or submit only what you have the right to share. You keep ownership; you give Kavaro LLC a license to host, show and promote it on TechBlob. Submitted videos are reviewed before they appear."] },
      {
        title: "3. Reports and blocks",
        body: [
          "You can report any video or comment and block anyone. We review every report within 24 hours and remove content or close accounts that break these terms. Threats of violence, child sexual abuse material and other illegal content are removed and reported to the authorities.",
        ],
      },
      { title: "4. Copyright", body: ["We respond to copyright notices under the DMCA and close the accounts of repeat infringers. See the DMCA page."] },
      { title: "5. Sponsored content", body: ["Sponsored premieres and Kavaro's own app cards are always labeled as such."] },
      { title: "6. Limit on liability", body: ["To the extent the law allows, Kavaro LLC's total liability to you is limited to what you paid Kavaro for TechBlob in the 12 months before the claim, and Kavaro isn't liable for indirect or consequential losses. Nothing here limits rights the law doesn't let us limit."] },
      { title: "7. Disputes", body: [`Disputes are resolved by individual arbitration under the Federal Arbitration Act, not class actions, except small-claims cases. You can opt out within 30 days of creating your account by emailing ${CONTACT}.`] },
    ],
  },
  {
    slug: "dmca",
    title: "Copyright and DMCA",
    intro: `If you believe something on TechBlob infringes your copyright, send a notice to Kavaro LLC at ${CONTACT} with the subject "DMCA notice".`,
    sections: [
      {
        title: "What a notice must include",
        body: [
          {
            list: [
              "Your physical or electronic signature.",
              "The copyrighted work you say is infringed.",
              "The TechBlob page (its link) with the material you want removed.",
              "Your name, address, phone number and email.",
              "A statement that you believe in good faith the use isn't authorized by the owner, its agent or the law.",
              "A statement, under penalty of perjury, that the notice is accurate and that you are the owner or authorized to act for the owner.",
            ],
          },
        ],
      },
      { title: "What happens next", body: ["We remove or disable the material promptly and tell the person who posted it. Videos that play through YouTube's embed are also YouTube's to remove; we take the TechBlob page down either way."] },
      { title: "Counter-notice", body: [`If your material was removed by mistake, email ${CONTACT} with your signature, the removed material and where it was, a statement under penalty of perjury that it was removed by mistake or misidentification, your name, address and phone, and consent to the jurisdiction of your local federal court. We restore it in 10 to 14 business days unless the claimant files suit.`] },
      { title: "Repeat infringers", body: ["Accounts that receive repeated valid copyright notices are closed."] },
    ],
  },
  {
    slug: "delete-account",
    title: "Delete your account",
    intro: "You can delete your TechBlob account and its data yourself.",
    sections: [
      { title: "On the site", body: ["Sign in, open Account, tap Delete account, type DELETE and confirm. Your account, comments, submissions, reports and blocks are removed right away and you are signed out."] },
      { title: "By email", body: [`If you can't sign in, email ${CONTACT} from your account's email with the subject "Delete my TechBlob account". We confirm when it's done.`] },
    ],
  },
  {
    slug: "support",
    title: "Support",
    intro: `Email ${CONTACT} and tell us what you were doing and what you saw.`,
    sections: [
      { title: "Report something", body: ["On a video, tap Report. On a comment, tap Report or Block. We review every report within 24 hours. In an emergency, call your local emergency number first."] },
      { title: "Copyright", body: ["See the DMCA page for how to send a notice."] },
    ],
  },
];

export const legalPage = (slug: string) => PAGES.find((p) => p.slug === slug) ?? null;
