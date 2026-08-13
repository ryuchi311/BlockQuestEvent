import pptxgen from "pptxgenjs";

const pptx = new pptxgen();

// Configure 16:9 Presentation
pptx.layout = "LAYOUT_16x9";
pptx.author = "BlockQuest";
pptx.company = "BlockQuest Team";
pptx.title = "BlockQuest Event Platform - User Manual & Flow Guide";

// Theme Colors
const BG_DARK = "0D1117";
const BG_CARD = "161B22";
const BG_CARD_BORDER = "30363D";
const GOLD = "F5A623";
const EMERALD = "10B981";
const BLUE = "24A1DE";
const WHITE = "FFFFFF";
const TEXT_MUTED = "8B949E";

// Helper function to create base slide
function createBaseSlide(title, subtitle, category = "USER MANUAL") {
  const slide = pptx.addSlide();
  slide.background = { color: BG_DARK };

  // Top header banner
  slide.addText(category.toUpperCase(), {
    x: 0.8,
    y: 0.5,
    w: 8.0,
    h: 0.3,
    fontSize: 10,
    fontFace: "Arial",
    color: GOLD,
    bold: true,
    letterSpacing: 2,
  });

  slide.addText(title, {
    x: 0.8,
    y: 0.8,
    w: 11.5,
    h: 0.6,
    fontSize: 22,
    fontFace: "Arial",
    color: WHITE,
    bold: true,
  });

  if (subtitle) {
    slide.addText(subtitle, {
      x: 0.8,
      y: 1.4,
      w: 11.5,
      h: 0.35,
      fontSize: 12,
      fontFace: "Arial",
      color: TEXT_MUTED,
    });
  }

  // Bottom footer
  slide.addText("BlockQuest Event Platform • Operations & User Guide", {
    x: 0.8,
    y: 7.0,
    w: 10.0,
    h: 0.3,
    fontSize: 9,
    fontFace: "Arial",
    color: TEXT_MUTED,
  });

  return slide;
}

// ─────────────────────────────────────────────────────────────
// SLIDE 1: Title Slide
// ─────────────────────────────────────────────────────────────
{
  const slide = pptx.addSlide();
  slide.background = { color: BG_DARK };

  // Decorative Card
  slide.addShape(pptx.shapes.RECTANGLE, {
    x: 1.0,
    y: 1.2,
    w: 11.3,
    h: 5.1,
    fill: { color: BG_CARD },
    line: { color: GOLD, width: 1.5 },
  });

  slide.addText("BLOCKQUEST EVENT PLATFORM", {
    x: 1.5,
    y: 1.8,
    w: 10.0,
    h: 0.4,
    fontSize: 12,
    fontFace: "Arial",
    color: GOLD,
    bold: true,
    letterSpacing: 3,
  });

  slide.addText("Complete Flow & User Manual", {
    x: 1.5,
    y: 2.3,
    w: 10.0,
    h: 0.9,
    fontSize: 32,
    fontFace: "Arial",
    color: WHITE,
    bold: true,
  });

  slide.addText(
    "Step-by-step operating guide for Event Attendees (Questers) and Event Staff / Admins.\nCovers Registration, Social Missions, QR Check-In, Quest Verifications, and RBAC Operations.",
    {
      x: 1.5,
      y: 3.3,
      w: 10.0,
      h: 1.0,
      fontSize: 14,
      fontFace: "Arial",
      color: TEXT_MUTED,
      lineSpacing: 22,
    }
  );

  // Two Part Badges
  slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
    x: 1.5,
    y: 4.6,
    w: 4.8,
    h: 1.1,
    fill: { color: "1F242C" },
    line: { color: BLUE, width: 1 },
  });
  slide.addText("PART 1: ATTENDEE GUIDE", {
    x: 1.7,
    y: 4.8,
    w: 4.4,
    h: 0.3,
    fontSize: 11,
    color: BLUE,
    bold: true,
  });
  slide.addText("Registration • Social Missions • QR Passes • Quests", {
    x: 1.7,
    y: 5.1,
    w: 4.4,
    h: 0.4,
    fontSize: 10,
    color: WHITE,
  });

  slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
    x: 6.6,
    y: 4.6,
    w: 5.2,
    h: 1.1,
    fill: { color: "1F242C" },
    line: { color: EMERALD, width: 1 },
  });
  slide.addText("PART 2: ADMIN & STAFF MANUAL", {
    x: 6.8,
    y: 4.8,
    w: 4.8,
    h: 0.3,
    fontSize: 11,
    color: EMERALD,
    bold: true,
  });
  slide.addText("QR Scanner • Proof Reviews • Quest & Staff Setup", {
    x: 6.8,
    y: 5.1,
    w: 4.8,
    h: 0.4,
    fontSize: 10,
    color: WHITE,
  });
}

// ─────────────────────────────────────────────────────────────
// SLIDE 2: Attendee Flow Step 1 - Registration
// ─────────────────────────────────────────────────────────────
{
  const slide = createBaseSlide(
    "Step 1: Attendee Registration & Credentials",
    "How users create their account and establish their event pass profile.",
    "PART 1: ATTENDEE GUIDE"
  );

  // Left Card: Instructions
  slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
    x: 0.8,
    y: 1.9,
    w: 7.2,
    h: 4.8,
    fill: { color: BG_CARD },
    line: { color: BG_CARD_BORDER, width: 1 },
  });

  slide.addText("Registration Process", {
    x: 1.1,
    y: 2.1,
    w: 6.6,
    h: 0.4,
    fontSize: 16,
    color: GOLD,
    bold: true,
  });

  const steps = [
    { text: "1. Access Registration Page: Navigate to the event link (/register).", options: { bold: true } },
    { text: "2. Fill Required Information: Enter Full Name, Email, Mobile Number, and Password.", options: {} },
    { text: "3. Country Code Selector: Built-in international dial codes (default +63 Philippines).", options: {} },
    { text: "4. Single-Field Name Entry: Streamlined single 'Name' field simplifies mobile sign-ups.", options: {} },
    { text: "5. Terms Agreement: Check the privacy terms checkbox and click 'Register'.", options: {} },
  ];
  slide.addText(steps, {
    x: 1.1,
    y: 2.6,
    w: 6.6,
    h: 3.8,
    fontSize: 12,
    color: WHITE,
    lineSpacing: 22,
  });

  // Right Card: Key Highlights & Tips
  slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
    x: 8.3,
    y: 1.9,
    w: 4.2,
    h: 4.8,
    fill: { color: BG_CARD },
    line: { color: BLUE, width: 1 },
  });

  slide.addText("💡 Key Quester Tips", {
    x: 8.6,
    y: 2.1,
    w: 3.6,
    h: 0.4,
    fontSize: 14,
    color: BLUE,
    bold: true,
  });

  slide.addText(
    "• Password Security: Stored using scryptSync salted cryptographic hashes.\n\n• Automatic Account Creation: Once registered, users can log back in at any time from any device.\n\n• Instant Pass Code Generation: System automatically creates a unique ticket code (e.g., BQF-X79K2M).",
    {
      x: 8.6,
      y: 2.7,
      w: 3.6,
      h: 3.7,
      fontSize: 11,
      color: WHITE,
      lineSpacing: 20,
    }
  );
}

// ─────────────────────────────────────────────────────────────
// SLIDE 3: Attendee Flow Step 2 - Dynamic Social Missions
// ─────────────────────────────────────────────────────────────
{
  const slide = createBaseSlide(
    "Step 2: Social Follow Missions Modal",
    "Dynamic social onboarding requirements before unlocking the QR pass.",
    "PART 1: ATTENDEE GUIDE"
  );

  // 3 Step Columns
  const missionSteps = [
    {
      title: "1. Trigger Modal",
      desc: "After registration or upon clicking 'Generate QR Pass', the Social Follow Missions modal opens automatically.",
      color: GOLD,
    },
    {
      title: "2. Follow & 10s Timer",
      desc: "Click each platform button (Facebook, Telegram, X, Discord). A 10-second verification countdown verifies each task.",
      color: BLUE,
    },
    {
      title: "3. Pass Unlock",
      desc: "Once all missions display '✓ Verified', the bottom 'Claim & Generate QR Pass' button illuminates in gold.",
      color: EMERALD,
    },
  ];

  missionSteps.forEach((s, idx) => {
    const xPos = 0.8 + idx * 4.0;
    slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
      x: xPos,
      y: 1.9,
      w: 3.6,
      h: 3.4,
      fill: { color: BG_CARD },
      line: { color: s.color, width: 1 },
    });

    slide.addText(s.title, {
      x: xPos + 0.3,
      y: 2.2,
      w: 3.0,
      h: 0.4,
      fontSize: 14,
      color: s.color,
      bold: true,
    });

    slide.addText(s.desc, {
      x: xPos + 0.3,
      y: 2.7,
      w: 3.0,
      h: 2.3,
      fontSize: 11,
      color: WHITE,
      lineSpacing: 18,
    });
  });

  // Bottom Notice
  slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
    x: 0.8,
    y: 5.6,
    w: 11.6,
    h: 1.1,
    fill: { color: "141E18" },
    line: { color: EMERALD, width: 1 },
  });
  slide.addText("🛡️ Fully Dynamic Configuration", {
    x: 1.1,
    y: 5.75,
    w: 11.0,
    h: 0.3,
    fontSize: 11,
    color: EMERALD,
    bold: true,
  });
  slide.addText(
    "Social follow tasks are fetched dynamically from the database. Superadmins can add, edit, reorder, or delete platforms directly from the Admin Dashboard without changing application code.",
    {
      x: 1.1,
      y: 6.05,
      w: 11.0,
      h: 0.5,
      fontSize: 10,
      color: WHITE,
    }
  );
}

// ─────────────────────────────────────────────────────────────
// SLIDE 4: Attendee Flow Step 3 - Event QR Pass
// ─────────────────────────────────────────────────────────────
{
  const slide = createBaseSlide(
    "Step 3: Accessing & Using the Event QR Pass",
    "Digital ticket pass generation, offline readiness, and gate scanning.",
    "PART 1: ATTENDEE GUIDE"
  );

  slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
    x: 0.8,
    y: 1.9,
    w: 6.0,
    h: 4.8,
    fill: { color: BG_CARD },
    line: { color: GOLD, width: 1 },
  });

  slide.addText("Event Pass Card Features", {
    x: 1.1,
    y: 2.1,
    w: 5.4,
    h: 0.4,
    fontSize: 15,
    color: GOLD,
    bold: true,
  });

  slide.addText(
    "• High-Resolution QR Code: Encodes ticket validation URL for instantaneous gate scanning.\n\n• Attendee Identity: Shows Attendee Name, Registered Email, and Unique Ticket Code.\n\n• Live XP Counter: Displays current earned XP balance right on the card header.\n\n• Download / Save: Questers can take a screenshot or download the QR code for seamless offline entry.",
    {
      x: 1.1,
      y: 2.7,
      w: 5.4,
      h: 3.7,
      fontSize: 11,
      color: WHITE,
      lineSpacing: 20,
    }
  );

  slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
    x: 7.2,
    y: 1.9,
    w: 5.2,
    h: 4.8,
    fill: { color: BG_CARD },
    line: { color: BLUE, width: 1 },
  });

  slide.addText("Gate Entry Workflow", {
    x: 7.5,
    y: 2.1,
    w: 4.6,
    h: 0.4,
    fontSize: 15,
    color: BLUE,
    bold: true,
  });

  slide.addText(
    "1. Arrive at Venue Entrance: Have your mobile phone ready with the QR pass on screen.\n\n2. Gate Staff Scan: Staff scans the pass using the Admin QR Scanner camera.\n\n3. Instant Validation: System checks attendee database and prompts confirmation modal.\n\n4. Wristband & Entry: Status switches to 'Checked In' and entrance is granted.",
    {
      x: 7.5,
      y: 2.7,
      w: 4.6,
      h: 3.7,
      fontSize: 11,
      color: WHITE,
      lineSpacing: 20,
    }
  );
}

// ─────────────────────────────────────────────────────────────
// SLIDE 5: Attendee Flow Step 4 - Quests & Verifications
// ─────────────────────────────────────────────────────────────
{
  const slide = createBaseSlide(
    "Step 4: Fiesta Quests, Proof Submissions & XP",
    "How attendees discover challenges, submit evidence, and earn rewards.",
    "PART 1: ATTENDEE GUIDE"
  );

  const questBoxes = [
    {
      title: "1. Discover Quests",
      desc: "Browse Fiesta Event Quests categorized by Onboarding, Social, Partner Boothing, and Special Challenges. Shows XP rewards & status (Live/Soon).",
      color: GOLD,
    },
    {
      title: "2. Submit Proof",
      desc: "For quests requiring verification, click 'Submit Proof' and upload a screenshot or photo. Images upload directly to secure S3 bucket storage.",
      color: BLUE,
    },
    {
      title: "3. Status Tracking",
      desc: "Track review progress in real time: 'Pending Review', 'Approved' (XP credited immediately), or 'Rejected' (with feedback explanation).",
      color: EMERALD,
    },
  ];

  questBoxes.forEach((b, idx) => {
    const xPos = 0.8 + idx * 4.0;
    slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
      x: xPos,
      y: 1.9,
      w: 3.6,
      h: 4.8,
      fill: { color: BG_CARD },
      line: { color: b.color, width: 1 },
    });

    slide.addText(b.title, {
      x: xPos + 0.3,
      y: 2.2,
      w: 3.0,
      h: 0.4,
      fontSize: 14,
      color: b.color,
      bold: true,
    });

    slide.addText(b.desc, {
      x: xPos + 0.3,
      y: 2.7,
      w: 3.0,
      h: 3.7,
      fontSize: 11,
      color: WHITE,
      lineSpacing: 18,
    });
  });
}

// ─────────────────────────────────────────────────────────────
// SLIDE 6: Admin Manual - Roles & RBAC Matrix
// ─────────────────────────────────────────────────────────────
{
  const slide = createBaseSlide(
    "Admin Operations: Role Hierarchy & Access Matrix",
    "Role-Based Access Control (RBAC) ensuring appropriate permissions per staff role.",
    "PART 2: ADMIN & STAFF MANUAL"
  );

  // Table Data
  const rows = [
    [
      { text: "Role Level", options: { bold: true, color: GOLD, fill: { color: "21262D" } } },
      { text: "Permitted Tabs & Capabilities", options: { bold: true, color: GOLD, fill: { color: "21262D" } } },
      { text: "Primary Responsibility", options: { bold: true, color: GOLD, fill: { color: "21262D" } } },
    ],
    [
      { text: "Superadmin", options: { bold: true, color: EMERALD } },
      { text: "Full Access: Staff Management, Social Missions, Quests, Verifications, Attendees, Scanner" },
      { text: "System owner, executive control, staff provisioning" },
    ],
    [
      { text: "Manager / Admin", options: { bold: true, color: BLUE } },
      { text: "Event Quests (Create/Edit), Attendees list, QR Scanner, Verifications" },
      { text: "Event operations, quest scheduling, attendee monitoring" },
    ],
    [
      { text: "Manage Quester", options: { bold: true, color: WHITE } },
      { text: "QR Scanner camera, Attendee list & manual check-in confirmation" },
      { text: "Entrance gate check-in & physical queue operations" },
    ],
    [
      { text: "Verifier", options: { bold: true, color: WHITE } },
      { text: "Quest Verifications Queue only (Approve / Reject with feedback)" },
      { text: "Validating quest proof submissions and granting XP" },
    ],
    [
      { text: "Viewer", options: { bold: true, color: TEXT_MUTED } },
      { text: "Read-only analytics and attendee viewer" },
      { text: "Sponsors, observers, and real-time monitoring" },
    ],
  ];

  slide.addTable(rows, {
    x: 0.8,
    y: 1.9,
    w: 11.6,
    h: 4.8,
    colW: [2.2, 5.8, 3.6],
    fontSize: 10,
    color: WHITE,
    border: { pt: 1, color: BG_CARD_BORDER },
    fill: { color: BG_CARD },
    margin: 8,
  });
}

// ─────────────────────────────────────────────────────────────
// SLIDE 7: Admin Manual - Scanner & Gate Check-In
// ─────────────────────────────────────────────────────────────
{
  const slide = createBaseSlide(
    "Gate Entry: Scanner & Check-In Verification",
    "How gate personnel process attendees swiftly and prevent accidental check-ins.",
    "PART 2: ADMIN & STAFF MANUAL"
  );

  slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
    x: 0.8,
    y: 1.9,
    w: 5.6,
    h: 4.8,
    fill: { color: BG_CARD },
    line: { color: BLUE, width: 1 },
  });

  slide.addText("📷 Built-in Camera Scanner", {
    x: 1.1,
    y: 2.1,
    w: 5.0,
    h: 0.4,
    fontSize: 15,
    color: BLUE,
    bold: true,
  });

  slide.addText(
    "1. Open Scanner: Navigate to the '📷 QR Scanner' tab on any smartphone, tablet, or laptop.\n\n2. Real-Time Viewfinder: Point device camera at attendee's digital or printed QR pass.\n\n3. Instant Lookup: System pulls attendee profile, pass validity, and current check-in status.\n\n4. Audio/Visual Feedback: Clear on-screen banner indicates whether pass is valid or already checked in.",
    {
      x: 1.1,
      y: 2.7,
      w: 5.0,
      h: 3.7,
      fontSize: 11,
      color: WHITE,
      lineSpacing: 20,
    }
  );

  slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
    x: 6.8,
    y: 1.9,
    w: 5.6,
    h: 4.8,
    fill: { color: BG_CARD },
    line: { color: GOLD, width: 1 },
  });

  slide.addText("⚠️ Safety Confirmation Modal", {
    x: 7.1,
    y: 2.1,
    w: 5.0,
    h: 0.4,
    fontSize: 15,
    color: GOLD,
    bold: true,
  });

  slide.addText(
    "• Accidental Tap Prevention: When clicking manual check-in or scanning, a confirmation modal appears.\n\n• Attendee Details Preview: Displays Attendee Name, Email, and Ticket Code.\n\n• Confirm Check-In: Staff must press 'Confirm Check-In' to commit status to the database.\n\n• Search Fallback: If an attendee has no phone, staff can search their name/email in the Attendees tab.",
    {
      x: 7.1,
      y: 2.7,
      w: 5.0,
      h: 3.7,
      fontSize: 11,
      color: WHITE,
      lineSpacing: 20,
    }
  );
}

// ─────────────────────────────────────────────────────────────
// SLIDE 8: Admin Manual - Quest Verifier Queue
// ─────────────────────────────────────────────────────────────
{
  const slide = createBaseSlide(
    "Quest Verifications Queue & Approvals",
    "How verifiers inspect evidence, award XP, and provide rejection reasons.",
    "PART 2: ADMIN & STAFF MANUAL"
  );

  const verifierSteps = [
    {
      title: "1. Inspection Queue",
      desc: "Open '🔍 Quest Verifications' tab. Filter submissions by 'Pending', 'Approved', or 'Rejected'. Submissions list Attendee Name, Quest Title, and timestamp.",
      color: GOLD,
    },
    {
      title: "2. Full-Screen Preview",
      desc: "Click screenshot proof to zoom and inspect image evidence with pan & drag controls to verify authenticity (e.g. booth photo, social post screenshot).",
      color: BLUE,
    },
    {
      title: "3. Decision Actions",
      desc: "• Approve: Credits XP immediately and records immutable completion receipt.\n• Reject: Prompts required rejection reason to guide the user on resubmission.",
      color: EMERALD,
    },
  ];

  verifierSteps.forEach((s, idx) => {
    const xPos = 0.8 + idx * 4.0;
    slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
      x: xPos,
      y: 1.9,
      w: 3.6,
      h: 4.8,
      fill: { color: BG_CARD },
      line: { color: s.color, width: 1 },
    });

    slide.addText(s.title, {
      x: xPos + 0.3,
      y: 2.2,
      w: 3.0,
      h: 0.4,
      fontSize: 14,
      color: s.color,
      bold: true,
    });

    slide.addText(s.desc, {
      x: xPos + 0.3,
      y: 2.7,
      w: 3.0,
      h: 3.7,
      fontSize: 11,
      color: WHITE,
      lineSpacing: 18,
    });
  });
}

// ─────────────────────────────────────────────────────────────
// SLIDE 9: Superadmin Manual - Dynamic Config & Staff Setup
// ─────────────────────────────────────────────────────────────
{
  const slide = createBaseSlide(
    "Superadmin Control: Dynamic Missions & Staff Setup",
    "Complete administrative autonomy without code changes or database migrations.",
    "PART 2: ADMIN & STAFF MANUAL"
  );

  slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
    x: 0.8,
    y: 1.9,
    w: 5.6,
    h: 4.8,
    fill: { color: BG_CARD },
    line: { color: GOLD, width: 1 },
  });

  slide.addText("📣 Dynamic Social Missions Modal", {
    x: 1.1,
    y: 2.1,
    w: 5.0,
    h: 0.4,
    fontSize: 15,
    color: GOLD,
    bold: true,
  });

  slide.addText(
    "• Add Mission Modal: Click '+ Add Mission' to configure new community tasks.\n\n• Customizable Attributes: Set Platform Icon (FB/TG/X/Discord/Web), Title, Description, Target URL, and Button Color.\n\n• Sort Ordering: Custom sequence controls the display priority in the registration modal.\n\n• Live Updates: Changes reflect instantly for newly registering attendees.",
    {
      x: 1.1,
      y: 2.7,
      w: 5.0,
      h: 3.7,
      fontSize: 11,
      color: WHITE,
      lineSpacing: 20,
    }
  );

  slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
    x: 6.8,
    y: 1.9,
    w: 5.6,
    h: 4.8,
    fill: { color: BG_CARD },
    line: { color: EMERALD, width: 1 },
  });

  slide.addText("🛡️ Staff Account Provisioning", {
    x: 7.1,
    y: 2.1,
    w: 5.0,
    h: 0.4,
    fontSize: 15,
    color: EMERALD,
    bold: true,
  });

  slide.addText(
    "• Dedicated Staff Tab: View all active administrators and staff accounts.\n\n• Create New Staff: Form allows assigning Email, Temporary Password, Name, and Role Level.\n\n• Built-in Cryptographic Security: Automatically salts and hashes passwords using node:crypto scryptSync.\n\n• Revocation: Instant deletion button to remove staff access on demand.",
    {
      x: 7.1,
      y: 2.7,
      w: 5.0,
      h: 3.7,
      fontSize: 11,
      color: WHITE,
      lineSpacing: 20,
    }
  );
}

// ─────────────────────────────────────────────────────────────
// SLIDE 10: Technical & Architecture Summary
// ─────────────────────────────────────────────────────────────
{
  const slide = createBaseSlide(
    "Database Architecture & XP Economy Integrity",
    "How the dual-table design prevents conflicts during quest edits or deletions.",
    "SYSTEM ARCHITECTURE"
  );

  slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
    x: 0.8,
    y: 1.9,
    w: 5.6,
    h: 4.8,
    fill: { color: BG_CARD },
    line: { color: BLUE, width: 1 },
  });

  slide.addText("💰 registrations.total_xp (Wallet)", {
    x: 1.1,
    y: 2.1,
    w: 5.0,
    h: 0.4,
    fontSize: 14,
    color: BLUE,
    bold: true,
  });

  slide.addText(
    "• Running Balance: Stored directly on the user row for instant leaderboard and profile rendering.\n\n• High Performance: Eliminates heavy SUM calculations during peak live-event traffic.\n\n• Leaderboard Ready: Indexed for rapid ranking updates.",
    {
      x: 1.1,
      y: 2.7,
      w: 5.0,
      h: 3.7,
      fontSize: 11,
      color: WHITE,
      lineSpacing: 20,
    }
  );

  slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
    x: 6.8,
    y: 1.9,
    w: 5.6,
    h: 4.8,
    fill: { color: BG_CARD },
    line: { color: EMERALD, width: 1 },
  });

  slide.addText("🧾 quest_completions.xp_awarded (Receipt)", {
    x: 7.1,
    y: 2.1,
    w: 5.0,
    h: 0.4,
    fontSize: 14,
    color: EMERALD,
    bold: true,
  });

  slide.addText(
    "• Immutable Audit Trail: Records exact XP granted at the historical moment of approval.\n\n• Conflict-Free Design: If an admin modifies a quest XP value or deletes the quest entirely, the user keeps their earned balance safely intact.\n\n• Duplicate Protection: UNIQUE(quest_id, user_email) prevents double-claiming.",
    {
      x: 7.1,
      y: 2.7,
      w: 5.0,
      h: 3.7,
      fontSize: 11,
      color: WHITE,
      lineSpacing: 20,
    }
  );
}

// Generate the file
const fileName = "BlockQuest_Event_Platform_User_Manual.pptx";
pptx.writeFile({ fileName })
  .then(() => {
    console.log(`Presentation successfully created: ${fileName}`);
  })
  .catch((err) => {
    console.error("Error creating presentation:", err);
  });
