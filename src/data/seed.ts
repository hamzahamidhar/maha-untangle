// Demo data: a made-up internal app ("TravelDesk") being user-acceptance tested.
// Edit freely. The headline story is the step-4 bug reported five different ways
// (r1–r5), plus a look-alike that is NOT the same bug (r6).

import type { KnownIssue, Report, TestStep } from "@/lib/types";

export const APP_NAME = "TravelDesk";

export const STEPS: TestStep[] = [
  { id: "S1", number: 1, name: "Sign in", instruction: "Open TravelDesk and sign in with your company account.", expected: "You land on the dashboard within 5 seconds." },
  { id: "S2", number: 2, name: "View dashboard", instruction: "Look at your list of past and upcoming trips.", expected: "Your trips are listed with dates (DD/MM/YYYY) and status." },
  { id: "S3", number: 3, name: "Start a trip request", instruction: "Click 'New trip' and enter a destination and dates.", expected: "The trip form opens with your details pre-filled." },
  { id: "S4", number: 4, name: "Choose cost centre", instruction: "Search for and select your cost centre in the Cost centre field.", expected: "Matching cost centres appear as you type and you can select one." },
  { id: "S5", number: 5, name: "Add flights", instruction: "Search for a return flight and add it to the trip.", expected: "The return flight is added to the trip summary with its price." },
  { id: "S6", number: 6, name: "Upload receipts", instruction: "Upload a receipt (PDF or photo) for any pre-paid costs.", expected: "The receipt appears in the list with a preview." },
  { id: "S7", number: 7, name: "Add hotel", instruction: "Choose a hotel near your destination and add it.", expected: "The hotel and nightly rate appear in the summary." },
  { id: "S8", number: 8, name: "Review summary", instruction: "Check the trip summary page.", expected: "All items and the total cost are shown correctly in GBP." },
  { id: "S9", number: 9, name: "Submit for approval", instruction: "Click 'Submit for approval'.", expected: "Exactly one request is created and you see a confirmation." },
  { id: "S10", number: 10, name: "Approval notification", instruction: "Wait for your approver's decision.", expected: "You get an email and an in-app notification." },
];

export const KNOWN_ISSUES: KnownIssue[] = [
  { id: "K1", stepId: "S10", title: "Approval emails delayed by up to 30 minutes", description: "Email notifications are queued and can arrive up to 30 minutes late. The in-app notification is not affected. Fix scheduled for the next release." },
  { id: "K2", stepId: "S2", title: "Dashboard loads slowly over VPN", description: "The dashboard can take 10+ seconds to load when connected through the VPN. Under investigation by the network team." },
];

type SeedReport = Omit<Report, "createdAt">;

export const SEED_REPORTS: SeedReport[] = [
  // --- One bug, five ways (step 4) ---
  { id: "r1", tester: "Priya S.", stepId: "S4", browser: "Chrome", comment: "Cost centre dropdown froze when I started typing in it. Had to refresh the whole page and lost my trip details." },
  { id: "r2", tester: "Tom W.", stepId: "S4", browser: "Edge", comment: "Page hangs on step 4. Couldn't pick anything, the field just stopped responding." },
  { id: "r3", tester: "Aisha K.", stepId: "S4", browser: "Chrome", comment: "When I search for my department code the list goes blank and then the whole page becomes unresponsive." },
  { id: "r4", tester: "Daniel O.", stepId: "S4", browser: "Chrome", comment: "Typing UK- into cost centre makes it spin forever, nothing loads." },
  { id: "r5", tester: "Mei L.", stepId: "S4", browser: "Firefox", comment: "can't select cost center, drop down just freezes" },
  // Look-alike: same step, different problem
  { id: "r6", tester: "Callum R.", stepId: "S4", browser: "Chrome", comment: "The cost centre list doesn't include R&D Liverpool (CC-4410), so I picked the wrong one to continue." },
  { id: "r7", tester: "Sofia G.", stepId: "S4", browser: "Edge", comment: "Would be nice if it remembered the cost centre I used last time." },

  // --- Large PDF uploads fail silently (step 6) ---
  { id: "r8", tester: "Ben T.", stepId: "S6", browser: "Chrome", comment: "Uploaded my hotel invoice PDF and nothing happened. No error, no file in the list." },
  { id: "r9", tester: "Hannah M.", stepId: "S6", browser: "Edge", comment: "Receipt upload fails silently for bigger PDFs - a 7MB scan never appears." },
  { id: "r10", tester: "Kwame A.", stepId: "S6", browser: "Chrome", comment: "Tried to attach a scanned receipt (large pdf), the upload bar finished but the receipt isn't there." },
  { id: "r11", tester: "Lucy P.", stepId: "S6", browser: "Safari", comment: "Photos from my iPhone (HEIC) are rejected with 'unsupported file type'." },
  { id: "r41", tester: "Omar F.", stepId: "S6", browser: "Chrome", comment: "Receipt preview is upside down for photos taken in portrait." },
  { id: "r12", tester: "Omar F.", stepId: "S6", browser: "Chrome", comment: "upload is a bit weird" },

  // --- Double submission (step 9) ---
  { id: "r13", tester: "Priya S.", stepId: "S9", browser: "Chrome", comment: "Clicked submit and it created two identical requests in my dashboard." },
  { id: "r14", tester: "Daniel O.", stepId: "S9", browser: "Chrome", comment: "Submit button doesn't disable after clicking. I double clicked and my manager got two approval requests." },
  { id: "r15", tester: "Mei L.", stepId: "S9", browser: "Firefox", comment: "Duplicate trip request appeared after submitting once." },
  { id: "r40", tester: "Lucy P.", stepId: "S9", browser: "Safari", comment: "Confirmation message says 'Request submited' - typo." },

  // --- Already known ---
  { id: "r16", tester: "Tom W.", stepId: "S10", browser: "Edge", comment: "Didn't receive the approval email, waited 15 minutes." },
  { id: "r17", tester: "Callum R.", stepId: "S10", browser: "Chrome", comment: "No email notification after my manager approved, but the in-app one appeared." },
  { id: "r18", tester: "Aisha K.", stepId: "S10", browser: "Chrome", comment: "Approval email arrived about 25 minutes late." },
  { id: "r19", tester: "Hannah M.", stepId: "S2", browser: "Edge", comment: "Dashboard took ages to load while I was on the VPN." },

  // --- Other bugs ---
  { id: "r20", tester: "Sofia G.", stepId: "S8", browser: "Edge", comment: "Total shows in USD instead of GBP on the summary page even though all my costs are in pounds." },
  { id: "r21", tester: "Ben T.", stepId: "S8", browser: "Chrome", comment: "Summary page currency is wrong - says $ not £." },
  { id: "r39", tester: "Tom W.", stepId: "S8", browser: "Edge", comment: "Edit button on the summary takes me back to step 1 instead of the item I want to change." },
  { id: "r22", tester: "Kwame A.", stepId: "S5", browser: "Chrome", comment: "Return flight search ignores my return date and shows one-way prices." },
  { id: "r23", tester: "Lucy P.", stepId: "S7", browser: "Safari", comment: "Hotel map doesn't load on Safari, just a grey box." },
  { id: "r24", tester: "Omar F.", stepId: "S3", browser: "Chrome", comment: "Destination field doesn't accept city names with accents (e.g. Málaga) - shows 'invalid destination'." },
  { id: "r25", tester: "Mei L.", stepId: "S1", browser: "Firefox", comment: "Sign-in took over 20 seconds and showed a blank white page before the dashboard." },
  { id: "r42", tester: "Mei L.", stepId: "S2", browser: "Firefox", comment: "Past trips list shows dates in US format (10/03 for 3 Oct)." },

  // --- Ideas, not bugs ---
  { id: "r26", tester: "Priya S.", stepId: "S5", browser: "Chrome", comment: "It'd be great if we could add train journeys, not just flights." },
  { id: "r27", tester: "Tom W.", stepId: "S5", browser: "Edge", comment: "Could you add rail options as well as flights? Most of my UK trips are by train." },
  { id: "r28", tester: "Hannah M.", stepId: "S2", browser: "Edge", comment: "Would love to see how much travel budget my team has left on the dashboard." },
  { id: "r29", tester: "Daniel O.", stepId: "S7", browser: "Chrome", comment: "Suggest showing the walking distance from the hotel to the office." },
  { id: "r30", tester: "Callum R.", stepId: "S3", browser: "Chrome", comment: "Maybe add a way to copy a previous trip as a template - I go to the same site every month." },

  // --- Too thin to act on yet ---
  { id: "r31", tester: "Kwame A.", stepId: "S7", browser: "Chrome", comment: "doesn't work" },
  { id: "r32", tester: "Lucy P.", stepId: "S3", browser: "Safari", comment: "Confusing." },
  { id: "r33", tester: "Omar F.", stepId: "S8", browser: "Chrome", comment: "numbers look off" },
  { id: "r34", tester: "Sofia G.", stepId: "S10", browser: "Edge", comment: "notification thing is strange" },

  // --- Not actionable / passes ---
  { id: "r35", tester: "Ben T.", stepId: "S1", browser: "Chrome", comment: "All fine, no issues." },
  { id: "r36", tester: "Aisha K.", stepId: "S2", browser: "Chrome", comment: "Looks good to me." },
  { id: "r37", tester: "Hannah M.", stepId: "S5", browser: "Edge", comment: "Ran out of time before finishing this step." },
  { id: "r38", tester: "Priya S.", stepId: "S7", browser: "Chrome", comment: "N/A" },
];
